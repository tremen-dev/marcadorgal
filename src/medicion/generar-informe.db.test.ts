import { readFileSync } from "node:fs";
import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import type { RawCapture } from "@/model";
import { createSql } from "../db/connect.ts";
import { encodeCapture } from "../raw/capture.ts";
import { createMemoryRawStore } from "../raw/memory.ts";
import { generarInforme } from "./generar-informe.ts";

// SPEC-025 CA-5: the whole report against the real schema, always rolled
// back, with the raw of the repo (live-2026-09-26.json) in a memory store:
// what npm run informe:latencia runs, with no network and no provider.

const sql = createSql(process.env);
const ROLLBACK = Symbol("rollback");
afterAll(() => sql.end());

async function rollback(fn: (tx: TransactionSql) => Promise<void>) {
  await sql
    .begin(async (tx) => {
      await fn(tx);
      throw ROLLBACK;
    })
    .catch((e) => {
      if (e !== ROLLBACK) throw e;
    });
}

// Cultural Leonesa 2-0 Coria of the fixture: kick-off 14:30:00Z
// (periods.first), goals at 17' and 31', captured at 15:10:00Z.
const LIVE = readFileSync(
  new URL(
    "../sources/api-football/fixtures/live-2026-09-26.json",
    import.meta.url,
  ),
  "utf8",
);
const at = (hms: string) => `2026-09-26T${hms}Z`;
const line = (o: object) => JSON.stringify(o);

describe("SPEC-025 CA-5 generarInforme", () => {
  it("writes the page from the base, the stored raw and the probe, asking nobody", () =>
    rollback(async (tx) => {
      const matchId = `primera-rfef-g1-test-${crypto.randomUUID()}`;
      await tx`insert into competitions (id, season, name, tier)
        values ('primera-rfef-g1', '2026-27', 'Primera Federación', 3) on conflict do nothing`;
      await tx`insert into teams (id, name) values ('test-home', 'Home'), ('test-away', 'Away')
        on conflict do nothing`;
      await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
        values (${matchId}, 'primera-rfef-g1', '2026-27', 5, ${at("14:30:00.000")},
          'test-home', 'test-away')`;

      const store = createMemoryRawStore();
      const capture: RawCapture = {
        sourceId: "api-football" as never,
        capturedAt: at("15:10:00.000"),
        requests: [
          {
            url: "https://v3.football.api-sports.io/fixtures?live=140-141-435-875-439",
            status: 200,
            contentType: "application/json",
            body: LIVE,
          },
        ],
      };
      const key = `api-football/2026-09-26/test-${crypto.randomUUID()}.json.gz`;
      await store.put(key, encodeCapture(capture), "application/gzip");
      const rawRef = `raw/${key}`;
      await tx`insert into storage.objects (bucket_id, name, created_at)
        values ('raw', ${key}, ${at("15:10:00.800")})`;
      await tx`insert into ingest_attempts (source_id, started_at, opened_at, raw_ref, details)
        values ('test-spec025', ${at("15:10:00.000")}, ${at("15:10:00.400")}, ${rawRef},
          ${tx.json({ requests: 1 })})`;
      const observe = async (s: string, home: number, ref: string) => {
        const [row] = await tx<{ id: string }[]>`
          insert into observations (match_id, source_id, status, home_score, away_score,
            minute, observed_at, received_at, raw_ref)
          values (${matchId}, 'api-football', 'live', ${home}, 0, 30, ${at(s)}, ${at(s)}, ${ref})
          returning id`;
        return row.id;
      };
      const o0 = await observe("15:09:30.000", 1, "raw/test/older.json.gz");
      const o1 = await observe("15:10:00.000", 2, rawRef);
      const decide = (home: number, obs: string, recorded: string) =>
        tx`insert into decisions (match_id, status, home_score, away_score, minute,
            qualifier, rule, observation_ids, decided_at, recorded_at)
          values (${matchId}, 'live', ${home}, 0, 30, 'confirmado', 'RN-01',
            ${tx.array([obs])}::uuid[], ${at(recorded)}, ${at(recorded)})`;
      await decide(1, o0, "15:09:31.000");
      await decide(2, o1, "15:10:01.500");

      const sonda = [
        line({ tipo: "inicio", instante: at("15:05:00.000") }),
        line({
          tipo: "pintura",
          ruta: "/",
          matchId,
          version: 1,
          marcador: "1-0",
          estado: "live",
          paintedAt: at("15:05:01.000"),
          inicial: true,
        }),
        line({
          tipo: "respuesta",
          ruta: "/",
          estado: 200,
          age: "3",
          xVercelCache: "HIT",
          date: "Sat, 26 Sep 2026 15:10:19 GMT",
          instante: at("15:10:19.900"),
        }),
        line({
          tipo: "pintura",
          ruta: "/",
          matchId,
          version: 2,
          marcador: "2-0",
          estado: "live",
          paintedAt: at("15:10:20.000"),
          inicial: false,
        }),
      ].join("\n");

      const out = await generarInforme({
        sql: tx,
        store,
        aliasFor: () => ({ matches: { "1570760": matchId as never } }),
        desde: at("14:29:00.000"),
        hasta: at("14:31:00.000"),
        sondas: [{ fichero: "sonda-test.jsonl", texto: sonda }],
        calibracionCsv: `matchId,gol,instante\n${matchId},2,${at("15:00:40")}\n`,
      });

      expect(out.crudosLeidos).toBe(1);
      expect(out.crudosAusentes).toEqual([]);
      // Goal 2 (31'): [15:00:00, 15:01:00) → middle 15:00:30; painted 15:10:20.
      expect(out.texto).toMatch(/\| \(e\) total \| 1 \| 590\.0 s \|/);
      // (a) 30 s, (b) 0.4 s, (c) 0.7 s, (d) 18.5 s, split 3 s + 15.5 s.
      expect(out.texto).toMatch(
        /\| \(a\) muestreo · reloj del tick \| 1 \| 30\.0 s/,
      );
      expect(out.texto).toMatch(
        /\| \(b\) petición \+ crudo · reloj de la base \| 1 \| 0\.4 s/,
      );
      expect(out.texto).toMatch(
        /\| \(c\) parse \+ inserción \+ motor · reloj de la base \| 1 \| 0\.7 s/,
      );
      expect(out.texto).toMatch(
        /\| \(d\) entrega · junta base ↔ sonda \| 1 \| 18\.5 s/,
      );
      expect(out.texto).toMatch(/\| \(d1\) CDN \(Age\) \| 1 \| 3\.0 s/);
      expect(out.texto).toMatch(/\| \(d2\) espera de polling \| 1 \| 15\.5 s/);
      // Goal 1 was already on screen when the probe opened: counted, not hidden.
      expect(out.texto).toContain("anterior a la sonda 1");
      // The owner's 15:00:40 is 10 s after the middle of the interval.
      expect(out.texto).toContain(
        "sesgo (mediana de manual − centro del intervalo) 10.0 s",
      );
      expect(out.texto).toContain("Por competición: primera-rfef-g1 2");
    }));
});

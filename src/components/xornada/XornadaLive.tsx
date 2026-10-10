"use client";

import { useEffect, useMemo, useState } from "react";
import type { Neighbours } from "@/board/weeks";
import { formatTime, type Locale, t } from "@/i18n";
import { realtimeConfig } from "@/live/config";
import type { LiveSnapshot, OpenChannel, Visibility } from "@/live/transport";
import type { Instant, PublicMatch } from "@/model";
import {
  rowAge,
  screenFreshness,
  type TransportNoticeKey,
  transportNotice,
} from "@/xornada/freshness";
import { boardMatches, initialBoard } from "@/xornada/live";
import { buildXornada, type XornadaDay } from "@/xornada/view";
import styles from "./Xornada.module.css";
import { XornadaBody } from "./XornadaBody";
import { REPAINT_EVENT } from "./XornadaFilters";

// SPEC-024 CA-4 (H-1): the state of / and /es in the client, one PublicMatch
// per matchId, painted with the same components as the server. The first
// render is the served HTML (same props, same instant), so hydration changes
// nothing; then the transport keeps it up to date (CA-6, CA-7).

// CA-6 (H-6): fixed at build time. Only «on» opens a socket, and only then is
// supabase-js downloaded (dynamic import).
const REALTIME_SWITCH = process.env.NEXT_PUBLIC_REALTIME;

// CA-9: the row ages are recalculated without the network.
const TICK_MS = 30_000;

export type XornadaLiveProps = {
  locale: Locale;
  paths: Readonly<Record<Locale, string>>;
  matches: readonly PublicMatch[];
  days: readonly XornadaDay[];
  unavailable: boolean;
  // The instant of the render (CA-8: «Actualizado ás HH:MM»).
  servedAt: Instant;
  // The season of the served xornada: the channel board:<season>.
  season: string;
  // The ETag /api/board gives for the served xornada.
  etag: string | null;
  // SPEC-027 CA-6: computed when served (N-3).
  arrows?: Neighbours;
};

function lazyOpener(config: { url: string; key: string }): OpenChannel {
  let opener: Promise<OpenChannel> | undefined;
  return async (season, handlers) => {
    opener ??= import("@/live/supabase").then((m) => m.supabaseOpener(config));
    return (await opener)(season, handlers);
  };
}

const documentVisibility: Visibility = {
  hidden: () => document.visibilityState === "hidden",
  subscribe(onChange) {
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  },
};

function FreshnessLine({
  locale,
  servedAt,
  lastSeen,
  now,
  notice,
  mode,
}: {
  locale: Locale;
  servedAt: Instant;
  lastSeen: number | null;
  now: number;
  notice: TransportNoticeKey | null;
  mode: string;
}) {
  let text: string;
  if (lastSeen === null)
    text = t(locale, "freshness.servedAt", {
      time: formatTime(servedAt, locale),
    });
  else {
    const f = screenFreshness(lastSeen, Math.max(now, lastSeen));
    text =
      f.key === "freshness.now"
        ? t(locale, "freshness.now")
        : t(locale, "freshness.ago", { n: f.n });
  }
  // H-5: words and neutral tokens; only the notice is a live region.
  return (
    <p
      className={styles.freshness}
      data-testid="freshness"
      data-transport={mode}
    >
      <span data-testid="freshness-age">{text}</span>
      <span
        className={styles.freshnessNotice}
        role="status"
        data-testid="freshness-notice"
      >
        {notice === null ? "" : t(locale, notice)}
      </span>
    </p>
  );
}

export function XornadaLive({
  locale,
  paths,
  matches,
  days,
  unavailable,
  servedAt,
  season,
  etag,
  arrows,
}: XornadaLiveProps) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot>(() => ({
    board: initialBoard(matches, days),
    mode: "polling",
    offline: false,
    lastSeen: null,
  }));
  const [now, setNow] = useState(() => Date.parse(servedAt));
  const [realtime, setRealtime] = useState(false);
  // Until the transport has loaded the screen is the served snapshot.
  const [started, setStarted] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: started once per page with the served state.
  useEffect(() => {
    const config =
      REALTIME_SWITCH === "on"
        ? realtimeConfig({
            flag: REALTIME_SWITCH,
            url: process.env.NEXT_PUBLIC_SUPABASE_URL,
            key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          })
        : null;
    // Folded at build: with the switch off, lazyOpener is never called, so
    // the supabase-js chunk (still emitted by the build) is never downloaded
    // and the bundle carries no Supabase URL or key.
    const openChannel =
      REALTIME_SWITCH === "on" && config !== null ? lazyOpener(config) : null;
    setRealtime(openChannel !== null);
    // The transport (and zod, through the one conversion of CA-3) loads
    // after the first paint: nothing of it is needed to show the snapshot.
    let live: { stop(): void } | null = null;
    let cancelled = false;
    void import("@/live/transport").then(({ startLiveXornada }) => {
      if (cancelled) return;
      const started = startLiveXornada({
        board: snapshot.board,
        season,
        etag,
        fetch: (input, init) => window.fetch(input, init),
        openChannel,
        random: Math.random,
        visibility: documentVisibility,
        onChange: setSnapshot,
      });
      live = started;
      setSnapshot(started.snapshot());
      setStarted(true);
    });
    return () => {
      cancelled = true;
      live?.stop();
    };
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // CA-5: after every repaint the filter and the fold are applied again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: fires on each new board, which it does not read.
  useEffect(() => {
    document.dispatchEvent(new Event(REPAINT_EVENT));
  }, [snapshot.board]);

  const list = useMemo(() => boardMatches(snapshot.board), [snapshot.board]);
  const competitions = useMemo(() => buildXornada(list), [list]);
  const ages = new Map<string, number>();
  for (const m of list) {
    const age = rowAge(m, now);
    if (age !== null) ages.set(m.matchId, age);
  }

  return (
    <XornadaBody
      locale={locale}
      competitions={competitions}
      days={snapshot.board.days}
      paths={paths}
      unavailable={unavailable && snapshot.lastSeen === null}
      ages={ages}
      arrows={arrows}
      freshness={
        <FreshnessLine
          locale={locale}
          servedAt={servedAt}
          lastSeen={snapshot.lastSeen}
          now={now}
          mode={started ? snapshot.mode : "served"}
          notice={transportNotice({
            realtime,
            mode: snapshot.mode,
            offline: snapshot.offline,
            started,
          })}
        />
      }
    />
  );
}

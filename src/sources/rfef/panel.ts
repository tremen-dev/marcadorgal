import {
  type CellReading,
  type DecodeContext,
  decodeCellTokens,
  isPackedDefinition,
  RfefFormatError,
  unpackNtype,
} from "./decode.ts";
import { type Token, tokenize } from "./html.ts";

// Reads the NFG_CMP_Paneles response (ADR-017): groups by codgrupo and, per
// row, «Jornada N», local day and time, both names, the acta link and the
// decoded score cell. Pure and closed: any row it cannot read throws
// RfefFormatError, so the request fails as a whole (ADR-017 §3).

export type ActaLink = { kind: "closed" | "open"; acta: string };

export type PanelRow = {
  codgrupo: string;
  round: number;
  // Local Europe/Madrid, without a year (the panel does not print it).
  day: number;
  month: number;
  hour: number;
  minute: number;
  home: string;
  away: string;
  acta: ActaLink | null;
  cell: CellReading;
};

export type Panel = { codgrupos: string[]; rows: PanelRow[] };

const fail = (message: string): never => {
  throw new RfefFormatError(message);
};

// Scripts and styles outside the score cells may not reach the score.
const SCRIPT_FORBIDDEN = [
  "ntype",
  "idh",
  "resu",
  "parpadea",
  "aplazado",
  "fa-",
  "eval",
  "getElementById",
  "classList",
  "innerHTML",
  "outerHTML",
  "innerText",
  "textContent",
  "insertRule",
  "document.write",
  ".text(",
];
const STYLE_FORBIDDEN = [
  /(^|[;{\s])content\s*:/,
  /:before/,
  /:after/,
  /#idh/,
  /\.fa-/,
  /visibility/,
];
// The only selectors the panel hides today (none of them inside a row).
const HIDDEN_SELECTORS = new Set([
  ".paginacion div",
  ".paginacion",
  ".ocultar-texto",
]);

function checkGlobalScript(text: string): void {
  for (const word of SCRIPT_FORBIDDEN)
    if (text.includes(word)) fail(`script outside the cells touches "${word}"`);
}

function checkGlobalStyle(text: string): void {
  for (const pattern of STYLE_FORBIDDEN)
    if (pattern.test(text)) fail(`style outside the cells with ${pattern}`);
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/display\s*:\s*none/.test(m[2])) continue;
    const selector = m[1].trim();
    if (!HIDDEN_SELECTORS.has(selector))
      fail(`style outside the cells hides "${selector}"`);
  }
}

const ACTA = /^verPartido(EnJuego)?\('(\d+)'\);?$/;
const DATE = /^\p{Lu}+\. (\d{1,2}) - (\d{1,2}) \/ (\d{1,2}):(\d{2})h\.$/u;

const normalize = (text: string) => text.replace(/[\s ]+/g, " ").trim();

type Draft = {
  codgrupo: string;
  round: number | null;
  names: string[];
  dates: string[];
  actas: Map<string, ActaLink>;
  cells: CellReading[];
};

function finish(draft: Draft): PanelRow {
  const where = `group ${draft.codgrupo}`;
  if (draft.names.length !== 2)
    fail(`${where}: a row with ${draft.names.length} names`);
  if (draft.dates.length !== 1 || draft.cells.length !== 1)
    fail(`${where}: a row without one date and one score`);
  if (draft.actas.size > 1) fail(`${where}: a row with two acta links`);
  if (draft.round === null) fail(`${where}: a row without «Jornada»`);
  const date = draft.dates[0].match(DATE);
  if (date === null) return fail(`${where}: date "${draft.dates[0]}"`);
  const [, day, month, hour, minute] = date.map(Number);
  return {
    codgrupo: draft.codgrupo,
    round: draft.round as number,
    day,
    month,
    hour,
    minute,
    home: draft.names[0],
    away: draft.names[1],
    acta: [...draft.actas.values()][0] ?? null,
    cell: draft.cells[0],
  };
}

export function readPanel(html: string): Panel {
  const tokens = tokenize(html);
  const ctx: DecodeContext = { table: null, ids: new Set() };
  const codgrupos: string[] = [];
  const rows: PanelRow[] = [];
  let group: { codgrupo: string; round: number | null } | null = null;
  let draft: Draft | null = null;
  // Capture of a name or a date: its texts until the span closes.
  let capture: { into: string[]; depth: number; text: string } | null = null;

  const close = () => {
    if (draft !== null) rows.push(finish(draft));
    draft = null;
  };

  for (let t = 0; t < tokens.length; t++) {
    const token = tokens[t];
    if (capture !== null) {
      if (token.kind === "text") capture.text += token.text;
      else if (token.kind === "open" && token.name === "span") capture.depth++;
      else if (token.kind === "close" && token.name === "span") {
        capture.depth--;
        if (capture.depth === 0) {
          capture.into.push(normalize(capture.text));
          capture = null;
        }
      }
      continue;
    }
    if (token.kind === "raw") {
      if (token.name === "script") {
        if (isPackedDefinition(token.text)) {
          const table = unpackNtype(token.text);
          if (ctx.table !== null && ctx.table.join() !== table.join())
            fail("ntype: redefined with another table");
          ctx.table = table;
        } else checkGlobalScript(token.text);
      } else checkGlobalStyle(token.text);
      continue;
    }
    if (token.kind === "text") {
      const round = token.text.match(/^[\s ]*Jornada (\d+)[\s ]*$/);
      if (round !== null && group !== null) group.round = Number(round[1]);
      continue;
    }
    if (token.kind !== "open") continue;
    const { name, attrs } = token;
    if (attrs.id?.startsWith("idh")) fail(`id ${attrs.id} outside a cell`);
    const onclick = attrs.onclick;
    if (onclick?.includes("verPartido")) {
      const m = onclick.match(ACTA);
      if (m === null || draft === null)
        return fail(`acta link of an unknown form: ${onclick}`);
      const link: ActaLink = { kind: m[1] ? "open" : "closed", acta: m[2] };
      draft.actas.set(`${link.kind}:${link.acta}`, link);
    }
    if (name === "table" && attrs.id?.startsWith("resultados_")) {
      close();
      const codgrupo = attrs.id.slice("resultados_".length);
      if (!/^\d+$/.test(codgrupo)) fail(`codgrupo "${codgrupo}"`);
      group = { codgrupo, round: null };
      codgrupos.push(codgrupo);
    } else if (name === "tr" && attrs.class === "res") {
      close();
      if (group === null) return fail("a row outside a group");
      draft = {
        codgrupo: group.codgrupo,
        round: group.round,
        names: [],
        dates: [],
        actas: new Map(),
        cells: [],
      };
    } else if (name === "span" && draft !== null) {
      const cls = attrs.class?.trim().split(/\s+/) ?? [];
      if (cls.includes("equipo_nombre"))
        capture = { into: draft.names, depth: 1, text: "" };
      else if (cls.includes("equipo") && cls.includes("fecha"))
        capture = { into: draft.dates, depth: 1, text: "" };
    } else if (name === "div" && attrs.class === "resu") {
      if (draft === null) return fail("a score cell outside a row");
      const inner: Token[] = [];
      let depth = 1;
      for (t++; t < tokens.length; t++) {
        const tk = tokens[t];
        if (tk.kind === "open" && tk.name === "div") depth++;
        if (tk.kind === "close" && tk.name === "div") depth--;
        if (depth === 0) break;
        inner.push(tk);
      }
      if (depth !== 0) fail("an unclosed score cell");
      draft.round = group?.round ?? null;
      draft.cells.push(decodeCellTokens(inner, ctx));
    }
  }
  close();
  if (codgrupos.length === 0) fail("not a panel: no group");
  return { codgrupos, rows };
}

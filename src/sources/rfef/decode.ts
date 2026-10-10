import { type Attrs, type Token, tokenize } from "./html.ts";

// Closed decoding of the score cell (ADR-017 §3, SPEC-031 CA-2/CA-4). It
// computes what a browser paints (::before + text + ::after, nothing under
// display:none) without running any script: ntype is unpacked as text. Only
// the forms seen in the real captures are accepted; anything else throws
// RfefFormatError and the whole request fails, never with a digit.

export class RfefFormatError extends Error {
  override name = "RfefFormatError";
}

const fail = (message: string): never => {
  throw new RfefFormatError(message);
};

export type DecodeContext = {
  // The ntype table, once the packed definition has been read (document order).
  table: readonly number[] | null;
  // Ids seen so far in the document: a duplicate would make getElementById
  // and #id rules reach another cell.
  ids?: Set<string>;
};

export type CellScore = { home: number; away: number };

export type CellReading = {
  // What a browser paints, without whitespace: "1-0", "-", "Suspendido".
  visible: string;
  blinking: boolean;
  score: CellScore | null;
  status: string | null;
};

// The packer as the panel ships it today (Dean Edwards' p,a,c,k,e,d).
const PACKER_HEAD =
  'eval(function(p,a,c,k,e,d){e=function(c){return c.toString(36)};if(!"".replace(/^/,String)){while(c--){d[c.toString(a)]=k[c]||c.toString(a)}k=[function(e){return d[e]}];e=function(){return"\\\\w+"};c=1}while(c--){if(k[c]){p=p.replace(new RegExp("\\\\b"+e(c)+"\\\\b","g"),k[c])}}return p}';
const PACKER_ARGS =
  /^\("([^"\\]*)",(\d{1,2}),(\d{1,3}),"([^"\\]*)"\.split\("\|"\),0,\{\}\)\);?$/;
// The unpacked function, with its shape of today.
const NTYPE_BODY =
  /^function ntype\(id,n,i,oc\)\{var t=\[([^\]]*)\];document\.getElementById\(id\)\.classList\.remove\(oc\);document\.getElementById\(id\)\.classList\.add\('fa-'\+t\[\(i\*10\)\+n\]\)\}$/;
const NTYPE_CALL = /^ntype\("(idh\d+)",(\d),(\d),"fa-(\d)"\);$/;
const PSEUDO_RULE =
  /^#(idh\d+):(before|after)\{content:"((?:\\[0-9a-fA-F]{1,6} ?|[^"\\])*)"(;display:none)?\}$/;

export const isPackedDefinition = (script: string): boolean =>
  script.trim().startsWith("eval(function(p,a,c,k,e,d)");

// The ntype table, read out of the packed definition without eval (CA-2).
export function unpackNtype(script: string): number[] {
  const text = script.trim();
  if (!text.startsWith(PACKER_HEAD))
    fail("ntype: packed definition with an unknown packer");
  const args = text.slice(PACKER_HEAD.length).match(PACKER_ARGS);
  if (args === null) return fail("ntype: packed arguments of an unknown form");
  const [, payload, radixText, countText, words] = args;
  const radix = Number(radixText);
  const count = Number(countText);
  if (radix < 2 || radix > 36) fail(`ntype: radix ${radix}`);
  const k = words.split("|");
  const dictionary = new Map<string, string>();
  for (let c = count - 1; c >= 0; c--) {
    const key = c.toString(radix);
    dictionary.set(key, k[c] || key);
  }
  // What the browser does: every word through the dictionary, "undefined"
  // for a word it does not hold.
  const body = payload.replace(
    /\b\w+\b/g,
    (word) => dictionary.get(word) ?? "undefined",
  );
  const shape = body.match(NTYPE_BODY);
  if (shape === null) return fail("ntype: unpacked function with another body");
  const digits = shape[1].split(",");
  if (digits.length !== 40 || !digits.every((d) => /^[0-9]$/.test(d)))
    fail(`ntype: table of ${digits.length} values, not 40 digits`);
  return digits.map(Number);
}

type Element = {
  tag: "root" | "span" | "i";
  id: string | null;
  hidden: boolean;
  blinking: boolean;
  status: boolean;
  fa: number | null;
  called: boolean;
  children: (Element | string)[];
};

const exactly = (attrs: Attrs, expected: Record<string, string | RegExp>) => {
  const keys = Object.keys(attrs);
  if (keys.length !== Object.keys(expected).length) return false;
  return keys.every((key) => {
    const want = expected[key];
    if (want === undefined) return false;
    return typeof want === "string"
      ? attrs[key] === want
      : want.test(attrs[key]);
  });
};

const ID = /^idh\d+$/;

function element(name: string, attrs: Attrs): Element {
  const base: Element = {
    tag: "span",
    id: null,
    hidden: false,
    blinking: false,
    status: false,
    fa: null,
    called: false,
    children: [],
  };
  if (name === "span") {
    if (exactly(attrs, { class: "parpadea" }))
      return { ...base, blinking: true };
    if (exactly(attrs, { class: "aplazado" })) return { ...base, status: true };
    if (exactly(attrs, { id: ID })) return { ...base, id: attrs.id };
    if (exactly(attrs, { style: "display:none;" }))
      return { ...base, hidden: true };
  }
  if (name === "i") {
    if (exactly(attrs, { class: "fa-solid" })) return { ...base, tag: "i" };
    if (
      exactly(attrs, {
        id: ID,
        style: "font-style:normal",
        class: /^fa-[0-9]$/,
      })
    )
      return {
        ...base,
        tag: "i",
        id: attrs.id,
        fa: Number(attrs.class.slice(3)),
      };
  }
  return fail(
    `cell: unknown form <${name}${Object.entries(attrs)
      .map(([k, v]) => ` ${k}="${v}"`)
      .join("")}>`,
  );
}

const unescapeCss = (content: string): string =>
  content.replace(/\\([0-9a-fA-F]{1,6}) ?/g, (_, hex: string) =>
    String.fromCodePoint(Number.parseInt(hex, 16)),
  );

const compact = (text: string) => text.replace(/[\s\u00a0]+/g, "");

type Pseudo = { content: string; hidden: boolean };
type Call = { id: string; n: number; i: number; from: number };

export function decodeCell(inner: string, ctx: DecodeContext): CellReading {
  return decodeCellTokens(tokenize(inner), ctx);
}

export function decodeCellTokens(
  tokens: readonly Token[],
  ctx: DecodeContext,
): CellReading {
  const root: Element = {
    tag: "root",
    id: null,
    hidden: false,
    blinking: false,
    status: false,
    fa: null,
    called: false,
    children: [],
  };
  const stack: Element[] = [root];
  const byId = new Map<string, Element>();
  const rules = new Map<string, Pseudo>();
  const calls: Call[] = [];

  for (const token of tokens) {
    const top = stack[stack.length - 1];
    switch (token.kind) {
      case "text":
        top.children.push(token.text);
        break;
      case "comment":
        fail("cell: unknown form (comment)");
        break;
      case "open": {
        const el = element(token.name, token.attrs);
        if (el.id !== null) {
          if (byId.has(el.id) || ctx.ids?.has(el.id))
            fail(`cell: duplicate id ${el.id}`);
          byId.set(el.id, el);
          ctx.ids?.add(el.id);
        }
        top.children.push(el);
        stack.push(el);
        break;
      }
      case "close":
        if (stack.length === 1 || top.tag !== token.name)
          fail(`cell: unexpected </${token.name}>`);
        stack.pop();
        break;
      case "raw": {
        if (Object.keys(token.attrs).length > 0)
          fail(`cell: <${token.name}> with attributes`);
        const text = token.text.trim();
        if (token.name === "style") {
          const rule = text.match(PSEUDO_RULE);
          if (rule === null) return fail(`cell: unknown style ${text}`);
          const [, id, pseudo, raw, hidden] = rule;
          const content = unescapeCss(raw);
          if (!/^[0-9]*$/.test(content))
            fail(`cell: content "${content}" is not a digit`);
          const key = `${id}:${pseudo}`;
          if (rules.has(key)) fail(`cell: two rules for ${key}`);
          rules.set(key, { content, hidden: hidden !== undefined });
          break;
        }
        if (isPackedDefinition(text)) {
          const table = unpackNtype(text);
          if (ctx.table !== null && ctx.table.join() !== table.join())
            fail("ntype: redefined with another table");
          ctx.table = table;
          break;
        }
        const call = text.match(NTYPE_CALL);
        if (call === null) return fail(`cell: unknown script ${text}`);
        if (ctx.table === null) fail("ntype: called before it is defined");
        const [, id, n, i, from] = call;
        calls.push({ id, n: Number(n), i: Number(i), from: Number(from) });
        break;
      }
    }
  }
  if (stack.length !== 1) fail("cell: unclosed element");

  const table = ctx.table ?? [];
  for (const call of calls) {
    const target = byId.get(call.id);
    if (target === undefined || target.tag !== "i" || target.fa === null)
      return fail(`ntype: no icon ${call.id} in the cell`);
    if (target.called) fail(`ntype: ${call.id} called twice`);
    if (target.fa !== call.from)
      fail(`ntype: ${call.id} has fa-${target.fa}, not fa-${call.from}`);
    const digit = table[call.i * 10 + call.n];
    if (digit === undefined) fail(`ntype: index ${call.i * 10 + call.n}`);
    target.fa = digit;
    target.called = true;
  }
  for (const [key] of rules) {
    const id = key.slice(0, key.indexOf(":"));
    const target = byId.get(id);
    if (target === undefined || target.tag !== "span")
      fail(`cell: rule on an absent id ${id}`);
  }
  for (const el of byId.values())
    if (el.fa !== null && !el.called) fail(`ntype: ${el.id} never called`);

  const pseudo = (el: Element, which: "before" | "after"): string => {
    if (el.id === null) return "";
    const rule = rules.get(`${el.id}:${which}`);
    return rule === undefined || rule.hidden ? "" : rule.content;
  };
  const paint = (node: Element | string, skipStatus: boolean): string => {
    if (typeof node === "string") return node;
    if (node.hidden || (skipStatus && node.status)) return "";
    const icon = node.fa === null ? "" : String(node.fa);
    return (
      icon +
      pseudo(node, "before") +
      node.children.map((c) => paint(c, skipStatus)).join("") +
      pseudo(node, "after")
    );
  };
  const all: Element[] = [];
  const walk = (el: Element) => {
    all.push(el);
    for (const c of el.children) if (typeof c !== "string") walk(c);
  };
  walk(root);

  const visible = compact(paint(root, false));
  const blinking = all.some((el) => el.blinking);
  const statuses = all.filter((el) => el.status);
  if (statuses.length > 1) fail("cell: more than one status");
  const status =
    statuses.length === 1 ? compact(paint(statuses[0], false)) : null;
  if (status !== null && !/^\p{L}+$/u.test(status))
    fail(`cell: status "${status}"`);
  const rest = compact(paint(root, true));

  const sides = rest.match(/^([^-]*)-([^-]*)$/);
  let score: CellScore | null = null;
  if (rest === "-" && status === null) score = null;
  else if (rest === "" && status !== null) score = null;
  else if (
    sides !== null &&
    /^\d{1,2}$/.test(sides[1]) &&
    /^\d{1,2}$/.test(sides[2])
  )
    score = { home: Number(sides[1]), away: Number(sides[2]) };
  else fail(`cell: a side that is not ^\\d{1,2}$ in "${rest}"`);

  return { visible, blinking, score, status };
}

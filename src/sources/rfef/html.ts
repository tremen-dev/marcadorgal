// A small HTML tokenizer for the PNFG panel (SPEC-031). It does not build a
// DOM and it runs nothing: it splits the text into tags, text and the raw
// content of <script> and <style>, which the decoder reads as text.

export type Attrs = Readonly<Record<string, string>>;

export type Token =
  | { kind: "open"; name: string; attrs: Attrs }
  | { kind: "close"; name: string }
  | { kind: "text"; text: string }
  | { kind: "raw"; name: "script" | "style"; attrs: Attrs; text: string }
  | { kind: "comment" };

// Legacy named references a browser also reads without the semicolon.
const NAMED: Readonly<Record<string, string>> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  lt: "<",
  gt: ">",
};

export function decodeEntities(text: string): string {
  return text.replace(
    /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);?/g,
    (match, ref: string) => {
      if (ref.startsWith("#")) {
        const code =
          ref[1] === "x" || ref[1] === "X"
            ? Number.parseInt(ref.slice(2), 16)
            : Number.parseInt(ref.slice(1), 10);
        return code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
      }
      const named = NAMED[ref.toLowerCase()];
      if (named === undefined) return match;
      // A longer name (&nbspx;) is not a legacy reference: keep it.
      return named;
    },
  );
}

const OPEN =
  /<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/y;
const CLOSE = /<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>/y;
const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function parseAttrs(source: string): Attrs {
  const attrs: Record<string, string> = {};
  for (const m of source.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    // The first occurrence wins, as in a browser.
    if (name in attrs) continue;
    attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

export function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let text = "";
  const flush = () => {
    if (text.length > 0)
      tokens.push({ kind: "text", text: decodeEntities(text) });
    text = "";
  };
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      text += html.slice(i);
      break;
    }
    text += html.slice(i, lt);
    i = lt;
    if (html.startsWith("<!--", i)) {
      flush();
      const end = html.indexOf("-->", i + 4);
      i = end === -1 ? html.length : end + 3;
      tokens.push({ kind: "comment" });
      continue;
    }
    if (html.startsWith("<!", i)) {
      flush();
      const end = html.indexOf(">", i);
      i = end === -1 ? html.length : end + 1;
      tokens.push({ kind: "comment" });
      continue;
    }
    CLOSE.lastIndex = i;
    const close = CLOSE.exec(html);
    if (close) {
      flush();
      tokens.push({ kind: "close", name: close[1].toLowerCase() });
      i = CLOSE.lastIndex;
      continue;
    }
    OPEN.lastIndex = i;
    const open = OPEN.exec(html);
    if (open) {
      flush();
      const name = open[1].toLowerCase();
      const attrs = parseAttrs(open[2]);
      i = OPEN.lastIndex;
      if (name === "script" || name === "style") {
        const closer = new RegExp(`</${name}`, "gi");
        closer.lastIndex = i;
        const end = closer.exec(html)?.index ?? -1;
        const stop = end === -1 ? html.length : end;
        tokens.push({ kind: "raw", name, attrs, text: html.slice(i, stop) });
        const gt = end === -1 ? -1 : html.indexOf(">", end);
        i = gt === -1 ? html.length : gt + 1;
      } else {
        tokens.push({ kind: "open", name, attrs });
      }
      continue;
    }
    text += "<";
    i += 1;
  }
  flush();
  return tokens;
}

import type { Locale } from "@/i18n";
import { LEGAL_ROUTES } from "./legal/content";

// SPEC-082 CA-2: the same page in each language, for the gl·es selector of
// the footer. Pure: the pathname in, both paths out. The Galician path has
// no prefix; the Spanish one has /es. An unknown route keeps itself and
// points at the other language's home.

const HOME: Readonly<Record<Locale, string>> = { gl: "/", es: "/es" };

// The sections served under both prefixes with the same name.
const SECTIONS = [
  "xornada",
  "demo",
  "competicion",
  "clasificacion",
  "calendario",
  "directos",
] as const;

const LEGAL_PAIRS: readonly (readonly [string, string])[] = Object.keys(
  LEGAL_ROUTES.gl,
).map((key) => {
  const k = key as keyof typeof LEGAL_ROUTES.gl;
  return [LEGAL_ROUTES.gl[k], LEGAL_ROUTES.es[k]] as const;
});

const trimSlash = (path: string): string =>
  path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;

const isSection = (rest: string): boolean =>
  SECTIONS.some((s) => rest === `/${s}` || rest.startsWith(`/${s}/`));

export function localePaths(pathname: string): Record<Locale, string> {
  const path = trimSlash(pathname) || "/";
  const locale: Locale =
    path === "/es" || path.startsWith("/es/") ? "es" : "gl";
  if (path === HOME[locale]) return { ...HOME };

  const legal = LEGAL_PAIRS.find(([gl, es]) =>
    locale === "gl" ? gl === path : es === path,
  );
  if (legal) return { gl: legal[0], es: legal[1] };

  const rest = locale === "es" ? path.slice("/es".length) : path;
  if (isSection(rest)) return { gl: rest, es: `/es${rest}` };

  return locale === "gl"
    ? { gl: path, es: HOME.es }
    : { gl: HOME.gl, es: path };
}

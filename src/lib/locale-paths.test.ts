import { describe, expect, it } from "vitest";
import { localePaths } from "./locale-paths";

// SPEC-082 CA-2: the gl·es selector of the footer points at the same page in
// the other language. Pure: the pathname in, both paths out.
describe("SPEC-082 CA-2 localePaths", () => {
  it.each([
    ["/", { gl: "/", es: "/es" }],
    ["/es", { gl: "/", es: "/es" }],
    ["/es/", { gl: "/", es: "/es" }],
    [
      "/xornada/2026-11-03",
      { gl: "/xornada/2026-11-03", es: "/es/xornada/2026-11-03" },
    ],
    [
      "/es/xornada/2026-11-03",
      { gl: "/xornada/2026-11-03", es: "/es/xornada/2026-11-03" },
    ],
    ["/demo/xornada", { gl: "/demo/xornada", es: "/es/demo/xornada" }],
    ["/es/demo/xornada", { gl: "/demo/xornada", es: "/es/demo/xornada" }],
    [
      "/competicion/liga-f",
      { gl: "/competicion/liga-f", es: "/es/competicion/liga-f" },
    ],
    [
      "/es/competicion/liga-f",
      { gl: "/competicion/liga-f", es: "/es/competicion/liga-f" },
    ],
    [
      "/clasificacion/segunda-rfef-g1",
      {
        gl: "/clasificacion/segunda-rfef-g1",
        es: "/es/clasificacion/segunda-rfef-g1",
      },
    ],
    [
      "/es/clasificacion/segunda-rfef-g1",
      {
        gl: "/clasificacion/segunda-rfef-g1",
        es: "/es/clasificacion/segunda-rfef-g1",
      },
    ],
    [
      "/calendario/primera-division",
      {
        gl: "/calendario/primera-division",
        es: "/es/calendario/primera-division",
      },
    ],
    [
      "/es/calendario/primera-division",
      {
        gl: "/calendario/primera-division",
        es: "/es/calendario/primera-division",
      },
    ],
    ["/directos", { gl: "/directos", es: "/es/directos" }],
    ["/es/directos", { gl: "/directos", es: "/es/directos" }],
    // The legal pages, from LEGAL_ROUTES: privacidade ↔ privacidad.
    ["/aviso-legal", { gl: "/aviso-legal", es: "/es/aviso-legal" }],
    ["/es/aviso-legal", { gl: "/aviso-legal", es: "/es/aviso-legal" }],
    ["/privacidade", { gl: "/privacidade", es: "/es/privacidad" }],
    ["/es/privacidad", { gl: "/privacidade", es: "/es/privacidad" }],
    ["/cookies", { gl: "/cookies", es: "/es/cookies" }],
    ["/es/cookies", { gl: "/cookies", es: "/es/cookies" }],
    // Unknown route → the other language's home; the current one stays.
    ["/non-existe", { gl: "/non-existe", es: "/es" }],
    ["/es/no-existe", { gl: "/", es: "/es/no-existe" }],
    ["/es/privacidade", { gl: "/", es: "/es/privacidade" }],
    ["/privacidad", { gl: "/privacidad", es: "/es" }],
    ["/esto", { gl: "/esto", es: "/es" }],
  ])("%s → %o", (pathname, paths) => {
    expect(localePaths(pathname)).toEqual(paths);
  });
});

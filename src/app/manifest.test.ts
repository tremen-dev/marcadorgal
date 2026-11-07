import { describe, expect, it } from "vitest";
import { COLORS } from "@/design/tokens";
import manifest from "./manifest";

describe("SPEC-051 CA-1 manifest()", () => {
  it("provides valid PWA properties for standalone mobile app", () => {
    const pwa = manifest();
    expect(pwa.name).toBe("marcador.gal");
    expect(pwa.short_name).toBe("marcador.gal");
    expect(pwa.start_url).toBe("/");
    expect(pwa.display).toBe("standalone");
    expect(pwa.background_color).toBe(COLORS.bg.value);
    expect(pwa.theme_color).toBe(COLORS.bg.value);
    expect(pwa.description).toBe(
      "Resultados galegos en directo de 1ª, 2ª, 1ª RFEF, 2ª RFEF e 3ª RFEF",
    );
  });

  it("declares 192 and 512 px icons for Chrome/Android installability", () => {
    const pwa = manifest();
    expect(pwa.icons).toBeDefined();
    const sizes = pwa.icons?.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(sizes).toContain("180x180");
  });
});

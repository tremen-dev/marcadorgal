import { describe, expect, it } from "vitest";
import { COLORS } from "@/design/tokens";
import { siteMetadata, siteViewport } from "./metadata";
import { homeMetadata } from "./xornada-home";

describe("SPEC-050 CA-2 siteMetadata", () => {
  it("gl defines metadataBase, title, description and icons", () => {
    const meta = siteMetadata("gl");
    expect(String(meta.metadataBase)).toBe("https://marcador.gal/");
    expect(meta.title).toBe("marcador.gal");
    expect(meta.description).toBe(
      "Resultados galegos en directo de 1ª, 2ª, 1ª RFEF, 2ª RFEF e 3ª RFEF",
    );
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.icons).toBeDefined();
    expect(meta.manifest).toBe("/manifest.webmanifest");
    expect(meta.appleWebApp).toEqual({
      capable: true,
      statusBarStyle: "black-translucent",
      title: "marcador.gal",
    });
    expect(siteViewport.themeColor).toBe(COLORS.bg.value);
  });

  it("es defines localized title and description", () => {
    const meta = siteMetadata("es");
    expect(String(meta.metadataBase)).toBe("https://marcador.gal/");
    expect(meta.title).toBe("marcador.gal");
    expect(meta.description).toBe(
      "Resultados gallegos en directo de 1ª, 2ª, 1ª RFEF, 2ª RFEF y 3ª RFEF",
    );
  });
});

describe("SPEC-050 CA-2 homeMetadata", () => {
  it("gl configures openGraph and twitter cards with summary_large_image", () => {
    const meta = homeMetadata("gl");
    expect(meta.title).toBe("Xornada · marcador.gal");
    expect(meta.description).toBe(
      "Resultados galegos en directo de 1ª, 2ª, 1ª RFEF, 2ª RFEF e 3ª RFEF",
    );
    expect(meta.openGraph).toEqual({
      title: "marcador.gal · Todo o fútbol galego nunha pantalla",
      description:
        "Resultados galegos en directo de 1ª, 2ª, 1ª RFEF, 2ª RFEF e 3ª RFEF",
      url: "/",
      siteName: "marcador.gal",
      locale: "gl_ES",
      type: "website",
      images: [
        {
          url: "/og.png",
          width: 1200,
          height: 630,
          alt: "marcador.gal · Todo o fútbol galego nunha pantalla",
          type: "image/png",
        },
      ],
    });
    expect(meta.twitter).toEqual({
      card: "summary_large_image",
      title: "marcador.gal · Todo o fútbol galego nunha pantalla",
      description:
        "Resultados galegos en directo de 1ª, 2ª, 1ª RFEF, 2ª RFEF e 3ª RFEF",
      images: ["/og.png"],
    });
  });

  it("es configures openGraph and twitter in Spanish with /es url", () => {
    const meta = homeMetadata("es");
    expect(meta.title).toBe("Jornada · marcador.gal");
    expect(meta.description).toBe(
      "Resultados gallegos en directo de 1ª, 2ª, 1ª RFEF, 2ª RFEF y 3ª RFEF",
    );
    expect(meta.openGraph?.title).toBe(
      "marcador.gal · Todo el fútbol gallego en una pantalla",
    );
    expect(meta.openGraph?.url).toBe("/es");
    expect(meta.openGraph?.locale).toBe("es_ES");
  });
});

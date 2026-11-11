import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  GALICIAN_CLUBS,
  getClubShield,
  getGalicianClub,
  isGalicianClub,
} from "./clubs.ts";

describe("Galician Clubs Catalog and Escudos", () => {
  it("includes depor-abanca and as-celtas as prominent women clubs", () => {
    const deporAbanca = getGalicianClub("depor-abanca");
    expect(deporAbanca).toBeDefined();
    expect(deporAbanca?.name).toBe("Deportivo ABANCA");
    expect(deporAbanca?.canonicalId).toBe("depor-abanca");
    expect(deporAbanca?.competitionId).toBe("liga-f");
    expect(deporAbanca?.gender).toBe("femenino");
    expect(deporAbanca?.shield).toBe("/escudos/depor-abanca.svg");
    expect(deporAbanca?.city).toBe("A Coruña");

    const asCeltas = getGalicianClub("as-celtas");
    expect(asCeltas).toBeDefined();
    expect(asCeltas?.name).toBe("RC Celta Femenino / As Celtas");
    expect(asCeltas?.canonicalId).toBe("as-celtas");
    expect(asCeltas?.competitionId).toBe("segunda-federacion-fem-g1");
    expect(asCeltas?.gender).toBe("femenino");
    expect(asCeltas?.shield).toBe("/escudos/as-celtas.svg");
    expect(asCeltas?.city).toBe("Vigo");
  });

  it("checks galician club membership", () => {
    expect(isGalicianClub("depor-abanca")).toBe(true);
    expect(isGalicianClub("as-celtas")).toBe(true);
    expect(isGalicianClub("celta")).toBe(true);
    expect(isGalicianClub("barcelona-femenino")).toBe(false);
  });

  it("resolves club shields by canonical ID or name search", () => {
    expect(getClubShield("depor-abanca")).toBe("/escudos/depor-abanca.svg");
    expect(getClubShield("as-celtas")).toBe("/escudos/as-celtas.svg");
    expect(getClubShield("Deportivo ABANCA")).toBe("/escudos/depor-abanca.svg");
    expect(getClubShield("As Celtas")).toBe("/escudos/as-celtas.svg");
    expect(getClubShield("RC Celta")).toBe("/escudos/celta.svg");
    expect(getClubShield("Desconocido FC")).toBeUndefined();
  });

  it("verifies that all referenced escudo SVG files exist in public/escudos", () => {
    for (const club of Object.values(GALICIAN_CLUBS)) {
      const filePath = path.join(
        process.cwd(),
        "public",
        club.shield.replace(/^\//, ""),
      );
      expect(
        existsSync(filePath),
        `Escudo for ${club.name} (${filePath}) must exist`,
      ).toBe(true);
    }
  });

  // SPEC-083 CA-2: a club carries no colours (nobody painted them).
  it("SPEC-083 CA-2 no club carries colours", () => {
    for (const club of Object.values(GALICIAN_CLUBS))
      expect(club).not.toHaveProperty("colors");
  });
});

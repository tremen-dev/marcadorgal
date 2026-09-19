import { es } from "./es";
import { gl } from "./gl";

export type Locale = "gl" | "es";
export type Dictionary = Record<keyof typeof gl, string>;

const dictionaries: Record<Locale, Dictionary> = { gl, es };

export function t(locale: Locale): Dictionary {
  return dictionaries[locale];
}

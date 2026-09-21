import { es } from "./es";
import { type Dictionary, gl } from "./gl";

export { formatDay, formatTime } from "./format";
export type { Dictionary } from "./gl";

export const LOCALES = ["gl", "es"] as const;
export type Locale = (typeof LOCALES)[number];

const dictionaries: Record<Locale, Dictionary> = { gl, es };

type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];

export type TranslationKey = Paths<typeof gl>;

type ValueAt<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? ValueAt<T[Head], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

type ParamNames<S> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | ParamNames<Rest>
  : never;

type ParamsOf<K extends TranslationKey> = ParamNames<ValueAt<typeof gl, K>>;

type ParamsArg<K extends TranslationKey> = [ParamsOf<K>] extends [never]
  ? []
  : [params: Readonly<Record<ParamsOf<K>, string | number>>];

export function t<K extends TranslationKey>(
  locale: Locale,
  key: K,
  ...[params]: ParamsArg<K>
): string {
  let node: unknown = dictionaries[locale];
  for (const segment of key.split(".")) {
    node = (node as Record<string, unknown>)[segment];
  }
  const template = node as string;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    String((params as Record<string, string | number>)[name]),
  );
}

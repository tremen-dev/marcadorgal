import type { MatchStatus, Qualifier } from "@/model";

// Keys of status and qualifier mirror the model enums (dominio.md, ADR-005 §1-2).
export const gl = {
  common: { title: "marcador.gal", switchLocale: "Castellano" },
  waiting: {
    heading: "Todo o fútbol galego nunha pantalla",
    body: "Estamos a preparar o marcador. Volve pronto.",
  },
  status: {
    scheduled: "Programado",
    live: "En xogo",
    finished: "Rematado",
    postponed: "Aprazado",
    suspended: "Suspendido",
  },
  qualifier: {
    confirmado: "confirmado",
    provisional: "provisional",
    sen_sinal: "sen sinal",
  },
  freshness: { lastData: "último dato hai {n} min" },
} as const satisfies {
  [group: string]: unknown;
  status: Record<MatchStatus, string>;
  qualifier: Record<Qualifier, string>;
};

type Shape<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : Shape<T[K]>;
};

export type Dictionary = Shape<typeof gl>;

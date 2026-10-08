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
  xornada: {
    title: "Xornada",
    liveCount: "{n} en xogo",
    locale: "Lingua",
    unavailable: "Os resultados non están dispoñibles agora mesmo.",
    // SPEC-021: half-time, a moment inside live (never an abbreviation).
    halfTime: "Descanso",
    // SPEC-023: the strip of days, the filters, the sidebar.
    days: "Días",
    dayLabel: "{weekday} {day}",
    dayMonthLabel: "{weekday} {day} {month}",
    empty: "nada aquí",
    round: "xornada {n}",
    competitions: "Competicións",
    matchCountOne: "{n} partido",
    matchCount: "{n} partidos",
  },
  weekday: {
    mon: "lun",
    tue: "mar",
    wed: "mér",
    thu: "xov",
    fri: "ven",
    sat: "sáb",
    sun: "dom",
  },
  month: {
    jan: "xan",
    feb: "feb",
    mar: "mar",
    apr: "abr",
    may: "maio",
    jun: "xuñ",
    jul: "xul",
    aug: "ago",
    sep: "set",
    oct: "out",
    nov: "nov",
    dec: "dec",
  },
  filter: {
    label: "Filtro",
    all: "Todos",
    live: "En xogo",
    finished: "Rematados",
  },
  locales: { gl: "gl", es: "es" },
} as const satisfies {
  [group: string]: unknown;
  status: Record<MatchStatus, string>;
  qualifier: Record<Qualifier, string>;
};

type Shape<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : Shape<T[K]>;
};

export type Dictionary = Shape<typeof gl>;

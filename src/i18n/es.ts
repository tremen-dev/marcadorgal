import type { Dictionary } from "./gl";

export const es: Dictionary = {
  common: { title: "marcador.gal", switchLocale: "Galego" },
  waiting: {
    heading: "Todo el fútbol gallego en una pantalla",
    body: "Estamos preparando el marcador. Vuelve pronto.",
  },
  status: {
    scheduled: "Programado",
    live: "En juego",
    finished: "Finalizado",
    postponed: "Aplazado",
    suspended: "Suspendido",
  },
  qualifier: {
    confirmado: "confirmado",
    provisional: "provisional",
    sen_sinal: "sin señal",
  },
  freshness: {
    lastData: "último dato hace {n} min",
    servedAt: "Actualizado a las {time}",
    now: "Actualizado ahora",
    ago: "Actualizado hace {n} min",
    polling: "Sin tiempo real: se actualiza cada 30 s",
    offline: "Sin conexión",
  },
  xornada: {
    title: "Jornada",
    liveCount: "{n} en juego",
    locale: "Idioma",
    unavailable: "Los resultados no están disponibles en este momento.",
    // SPEC-021: half-time, a moment inside live (never an abbreviation).
    halfTime: "Descanso",
    // SPEC-023: the strip of days, the filters, the sidebar.
    days: "Días",
    dayLabel: "{weekday} {day}",
    dayMonthLabel: "{weekday} {day} {month}",
    empty: "nada aquí",
    round: "jornada {n}",
    competitions: "Competiciones",
    matchCountOne: "{n} partido",
    matchCount: "{n} partidos",
    // SPEC-027 CA-6: the arrows of the strip, to the neighbour weeks.
    previous: "Jornada anterior",
    next: "Jornada siguiente",
  },
  weekday: {
    mon: "lun",
    tue: "mar",
    wed: "mié",
    thu: "jue",
    fri: "vie",
    sat: "sáb",
    sun: "dom",
  },
  month: {
    jan: "ene",
    feb: "feb",
    mar: "mar",
    apr: "abr",
    may: "may",
    jun: "jun",
    jul: "jul",
    aug: "ago",
    sep: "sep",
    oct: "oct",
    nov: "nov",
    dec: "dic",
  },
  filter: {
    label: "Filtro",
    all: "Todos",
    live: "En juego",
    finished: "Finalizados",
  },
  locales: { gl: "gl", es: "es" },
};

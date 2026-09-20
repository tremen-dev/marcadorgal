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
  freshness: { lastData: "último dato hace {n} min" },
};

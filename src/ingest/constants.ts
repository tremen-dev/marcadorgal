// Every number of the ingest core, with the rule that fixes it.

// Window of a match (ADR-002 §2): ten minutes before kickoff and two hours
// and a half after it, which covers stoppage time and a long interruption.
export const WINDOW_BEFORE_MINUTES = 10;
export const WINDOW_AFTER_MINUTES = 150;

// Cadence (RN-08, ADR-008 §3): the registry declares 30 s, and the guard
// tolerates the jitter of the two triggers. Worst case: two calls 25 s apart.
export const CADENCE_JITTER_SECONDS = 5;

// The traffic light of npm run tick:salud (CA-7, N-5). The verdict is decided
// on a short window and not on the whole hour: a blip at 18:00 fixed at 18:10
// would otherwise keep the report red until 19:00, and a semaphore nobody
// believes is a semaphore nobody looks at. Ten minutes is ~20 runs of a job
// that fires every 30 s —enough that a healthy tick shows up— and it is
// shorter than the fifteen minutes of RN-05, so the report turns red before
// the engine starts opening silence alerts. The hour stays on screen as
// context, with at most five failures listed and a count for the rest: the
// whole report has to fit in one screen while a matchday is running.
export const SALUD_RECENT_MINUTES = 10;
export const SALUD_FAILURES_SHOWN = 5;

// Raw retention (D-6, ADR-007 §5): thirty days, purged by the tick itself at
// most once a day, retried an hour after a failure, a thousand keys per call.
export const RAW_RETENTION_DAYS = 30;
export const PURGE_EVERY_HOURS = 24;
export const PURGE_RETRY_HOURS = 1;
export const PURGE_BATCH = 1000;

// Informe de la jornada (SPEC-009). Every threshold is fixed here, before
// measuring, so reading the numbers cannot move them (CA-9).

// A gap between two consecutive observations of a match above this is not
// jitter: it is three times the declared 30 s cadence, so the tick missed at
// least two turns. It is what gives away a job that fell (CA-2 (a)).
export const INFORME_GAP_SECONDS = 90;

// Below this many samples a "p95" is the maximum wearing a statistician's
// hat: it is printed as `peor caso (n=<n>)` instead (CA-3).
export const INFORME_P95_MIN_SAMPLES = 20;

// The cadence the two triggers aim at (ADR-008 §3): the divisor of the
// expected ticks, and therefore of the coverage the verdict reads (CA-9).
export const INFORME_TICK_SECONDS = 30;

// Budget of SPEC-005 N-4 for the Pro plan.
export const INFORME_REQUESTS_PER_MINUTE = 6;
export const INFORME_REQUESTS_PER_DAY = 3000;

// vision.md: what is contrasted, never what is assumed.
export const INFORME_MEDIAN_TARGET_SECONDS = 45;
export const INFORME_P95_TARGET_SECONDS = 90;

// CA-9 thresholds: at or above the first the matchday is `válida`, between
// the two `válida con reservas`, below the second `no válida` branch (c1).
export const INFORME_COVERAGE_VALID = 0.95;
export const INFORME_COVERAGE_RESERVED = 0.8;

// Goals per match used only to say the expectable size of the external
// sample (CA-3): 39 matches -> ~98 goals, the "90-100" of the spec.
export const INFORME_GOALS_PER_MATCH = 2.5;

// How many rows of a list the report prints before collapsing the rest into a
// count. The informe has to fit in two pages (CA-10) and a jornada of 39
// matches produces hundreds of gaps: what is actionable is the headline count
// plus a sample. Discrepancies and unmatched references are never collapsed —
// those are the rows somebody has to work through one by one.
//
// Ten was calibrated against a fixture whose lists were almost all empty, and
// it did not hold (V-7): the report has eight capped lists, so ten rows each
// is eighty lines of lists over some seventy-five of prose, and the worst case
// —every capped list saturated— measured 208 lines against a 145 tope. Five is
// what the arithmetic allows, and the ceiling is now measured, not assumed.
export const INFORME_FILAS_MOSTRADAS = 5;

// «Cabe en dos páginas» (CA-10) es un número o no es nada: dos páginas de texto
// monoespaciado impreso a 9-10 pt con márgenes normales son unas 72 líneas por
// página. Las discrepancias del contraste y las referencias no casadas siguen
// sin recortarse: un informe lleno de discrepancias ya no es el informe que
// CA-10 dimensiona, es una lista de trabajo.
//
// El tope se cumple ahora **por construcción** y no por suerte del fixture
// (V-7): nada de lo que el informe imprime crece sin tope salvo esas dos
// listas, y el caso que satura a la vez todo lo demás —cinco competiciones,
// las ocho listas acotadas llenas, el tick muerto, una alerta por partido—
// está medido en `informe.test.ts` («el techo de todo lo que puede crecer a la
// vez»): **137 líneas**, ocho por debajo del tope. Para llegar ahí hicieron
// falta tres recortes de verdad, no uno: `INFORME_FILAS_MOSTRADAS` de diez a
// cinco, la prosa que se repetía (el desglose por competición del bloque 1 ya
// estaba en la primera línea del informe; el «(ninguno)» debajo de una cuenta
// que ya dice 0) y la línea en blanco bajo cada título, que es maquetación.
export const INFORME_MAX_LINEAS = 145;

// Ningún valor de `.env` puede aparecer en el informe (CA-1), que imprime
// `ingest_attempts.error` y `alerts.details` tal cual. Se redactan los valores
// del entorno en bloque, pero solo desde esta longitud: por debajo no hay
// secretos que perder y sí informe que destrozar, porque un valor corto
// ("true", "es_ES", un número) aparece por casualidad en cualquier texto.
export const INFORME_SECRET_MIN_LENGTH = 8;

import { type Locale, t } from "@/i18n";
import { type CountTemplates, formatCount } from "@/xornada/filter";
import type { XornadaDay } from "@/xornada/view";

// SPEC-023: the words of the strip and of the sidebar, from src/i18n.

export function dayLabel(day: XornadaDay, locale: Locale): string {
  const weekday = t(locale, day.weekdayKey);
  // B-2: the month only when it is not the month of today.
  const label = day.otherMonth
    ? t(locale, "xornada.dayMonthLabel", {
        weekday,
        day: day.dayOfMonth,
        month: t(locale, day.monthKey),
      })
    : t(locale, "xornada.dayLabel", { weekday, day: day.dayOfMonth });
  // Today in capitals, as the design writes it («SÁB 30»).
  return day.today ? label.toLocaleUpperCase(locale) : label;
}

// The raw templates, `{n}` kept, for the client to fill (F-4).
export function matchCountTemplates(locale: Locale): CountTemplates {
  return {
    one: t(locale, "xornada.matchCountOne", { n: "{n}" }),
    other: t(locale, "xornada.matchCount", { n: "{n}" }),
  };
}

export function liveCountTemplates(locale: Locale): CountTemplates {
  const template = t(locale, "xornada.liveCount", { n: "{n}" });
  return { one: template, other: template };
}

export const matchCountLabel = (locale: Locale, n: number): string =>
  formatCount(matchCountTemplates(locale), n);

export const liveCountLabel = (locale: Locale, n: number): string =>
  formatCount(liveCountTemplates(locale), n);

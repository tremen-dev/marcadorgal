import { type Locale, t } from "@/i18n";
import { type CountTemplates, formatCount } from "@/xornada/filter";
import { xornadaSpan } from "@/xornada/range";
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

// SPEC-028 CA-5 (H-7): «10–12 out», «30 set – 2 out», «11 out»; null with
// no days. The span is pure (src/xornada/range.ts); the words are i18n.
export function xornadaRange(
  days: readonly XornadaDay[],
  locale: Locale,
): string | null {
  const span = xornadaSpan(days);
  if (span === null) return null;
  const { from, to } = span;
  if (from.dayOfMonth === to.dayOfMonth && from.monthKey === to.monthKey)
    return t(locale, "xornada.rangeOneDay", {
      day: from.dayOfMonth,
      month: t(locale, from.monthKey),
    });
  if (from.monthKey === to.monthKey)
    return t(locale, "xornada.rangeSameMonth", {
      from: from.dayOfMonth,
      to: to.dayOfMonth,
      month: t(locale, to.monthKey),
    });
  return t(locale, "xornada.rangeTwoMonths", {
    from: from.dayOfMonth,
    fromMonth: t(locale, from.monthKey),
    to: to.dayOfMonth,
    toMonth: t(locale, to.monthKey),
  });
}

// SPEC-028 CA-6: the visible <h1>, «Xornada · 10–12 out», or «Xornada» alone
// when there is no range (no data, unavailable).
export function xornadaHeading(
  days: readonly XornadaDay[],
  locale: Locale,
): string {
  const range = xornadaRange(days, locale);
  return range === null
    ? t(locale, "xornada.title")
    : t(locale, "xornada.heading", { range });
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

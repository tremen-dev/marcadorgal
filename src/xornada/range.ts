import type { MonthKey, XornadaDay } from "./view";

// SPEC-028 CA-5 (H-7): the first and last day of the served xornada, the
// same days as the strip. Pure: which days and which months; putting them
// into words is the components' job (i18n stays out of src/xornada/).

export type SpanEnd = { dayOfMonth: number; monthKey: MonthKey };
export type XornadaSpan = { from: SpanEnd; to: SpanEnd };

const endOf = ({ dayOfMonth, monthKey }: XornadaDay): SpanEnd => ({
  dayOfMonth,
  monthKey,
});

// `days` comes from xornadaDays: distinct Madrid dates, ascending.
export function xornadaSpan(days: readonly XornadaDay[]): XornadaSpan | null {
  if (days.length === 0) return null;
  return { from: endOf(days[0]), to: endOf(days[days.length - 1]) };
}

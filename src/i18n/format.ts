import type { Instant } from "@/model";
import type { Locale } from "./index";

// D-9: i18n only formats instants; it never decides which clock they come from.
const TIME_ZONE = "Europe/Madrid";

export function formatTime(instant: Instant, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TIME_ZONE,
  }).format(new Date(instant));
}

// «sáb 26»: ICU short weekday, lowercase, without its trailing dot; day without zero.
export function formatDay(instant: Instant, locale: Locale): string {
  const date = new Date(instant);
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: TIME_ZONE,
  })
    .format(date)
    .toLowerCase()
    .replace(/\.$/, "");
  const day = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);
  return `${weekday} ${day}`;
}

import { type Locale, t } from "@/i18n";
import type { FilterCounts } from "@/xornada/filter";
import type { XornadaDay } from "@/xornada/view";
import styles from "./Xornada.module.css";

// SPEC-023 CA-2 and CA-3: the strip of days and the filters, served as plain
// links over the whole xornada. Without JavaScript nothing is selected but
// Todos (H-3); XornadaFilters applies the fragment over this HTML.

export function dayLabel(day: XornadaDay, locale: Locale): string {
  const label = t(locale, "xornada.dayLabel", {
    weekday: t(locale, day.weekdayKey),
    day: day.dayOfMonth,
  });
  // Today in capitals, as the design writes it («SÁB 30»).
  return day.today ? label.toLocaleUpperCase(locale) : label;
}

export function DayStrip({
  days,
  locale,
}: {
  days: readonly XornadaDay[];
  locale: Locale;
}) {
  return (
    <nav
      className={styles.days}
      aria-label={t(locale, "xornada.days")}
      data-testid="day-strip"
    >
      {days.map((day) => (
        <a
          key={day.date}
          className={styles.day}
          href={`#d=${day.date}`}
          data-day-link={day.date}
          data-today={day.today ? "true" : undefined}
          data-testid="day-link"
        >
          {dayLabel(day, locale)}
        </a>
      ))}
    </nav>
  );
}

export function FilterPills({
  counts,
  locale,
  selfHref,
}: {
  counts: FilterCounts;
  locale: Locale;
  // Todos is the screen with no fragment; the client keeps it in step.
  selfHref: string;
}) {
  return (
    <nav
      className={styles.filters}
      aria-label={t(locale, "filter.label")}
      data-testid="filters"
    >
      <a
        className={styles.pill}
        href={selfHref}
        data-filter-link="all"
        aria-current="true"
        data-testid="filter-all"
      >
        {t(locale, "filter.all")}{" "}
        <span className={styles.pillCount} data-count="all">
          {counts.all}
        </span>
      </a>
      <a
        className={styles.pillLive}
        href="#f=live"
        data-filter-link="live"
        data-testid="filter-live"
      >
        {t(locale, "filter.live")}{" "}
        <span className={styles.pillCountLive} data-count="live">
          {counts.live}
        </span>
      </a>
      <a
        className={styles.pill}
        href="#f=finished"
        data-filter-link="finished"
        data-testid="filter-finished"
      >
        {t(locale, "filter.finished")}{" "}
        <span className={styles.pillCount} data-count="finished">
          {counts.finished}
        </span>
      </a>
    </nav>
  );
}

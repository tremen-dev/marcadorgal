import type { Neighbours } from "@/board/weeks";
import { type Locale, t } from "@/i18n";
import type { FilterCounts } from "@/xornada/filter";
import type { XornadaDay } from "@/xornada/view";
import { dayLabel } from "./labels";
import styles from "./Xornada.module.css";

// SPEC-023 CA-2 and CA-3: the strip of days and the filters, served as plain
// links over the whole xornada. Without JavaScript nothing is selected but
// Todos (H-3); XornadaFilters applies the fragment over this HTML.

// SPEC-027 CA-6 (H-6): ‹ and › to the neighbour weeks, outside the part
// that scrolls. Plain links without the fragment; with no neighbour, a gap of
// the same width that is neither read nor focused.
function WeekArrow({
  href,
  dir,
  locale,
}: {
  href: string | null;
  dir: "previous" | "next";
  locale: Locale;
}) {
  if (href === null)
    return (
      <span
        className={styles.weekArrow}
        aria-hidden="true"
        data-testid={`week-${dir}-gap`}
      />
    );
  // biome-ignore-start lint/a11y/useAnchorContent: the accessible name is the aria-label (CA-6); the glyph is aria-hidden.
  return (
    <a
      className={styles.weekArrow}
      href={href}
      aria-label={t(locale, `xornada.${dir}`)}
      data-testid={`week-${dir}`}
    >
      <span aria-hidden="true">{dir === "previous" ? "‹" : "›"}</span>
    </a>
  );
  // biome-ignore-end lint/a11y/useAnchorContent: the accessible name is the aria-label (CA-6); the glyph is aria-hidden.
}

export function DayStrip({
  days,
  locale,
  arrows,
}: {
  days: readonly XornadaDay[];
  locale: Locale;
  // SPEC-027: the pages of the public xornada; the demos have none.
  arrows?: Neighbours;
}) {
  if (arrows === undefined) return <Days days={days} locale={locale} />;
  return (
    <div className={styles.strip} data-testid="week-strip">
      <WeekArrow href={arrows.previous} dir="previous" locale={locale} />
      <Days days={days} locale={locale} inStrip />
      <WeekArrow href={arrows.next} dir="next" locale={locale} />
    </div>
  );
}

function Days({
  days,
  locale,
  inStrip = false,
}: {
  days: readonly XornadaDay[];
  locale: Locale;
  inStrip?: boolean;
}) {
  return (
    <nav
      className={inStrip ? `${styles.days} ${styles.daysInStrip}` : styles.days}
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

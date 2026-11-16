import { notFound } from "next/navigation";
import { CalendarView } from "../components/competition/CalendarView.tsx";
import { CompetitionHeader } from "../components/competition/CompetitionHeader.tsx";
import { StandingsTable } from "../components/competition/StandingsTable.tsx";
import { CompetitionNav } from "../components/navigation/CompetitionNav.tsx";
import { type Locale, t } from "../i18n/index.ts";
import {
  type CompetitionExplorer,
  type CompetitionResult,
  loadCompetitionCalendar,
  loadCompetitionStandings,
} from "../lib/competition-data.ts";
import {
  getCompetitionMetadata,
  isAllowedCompetition,
} from "../model/index.ts";
import styles from "./CompetitionPage.module.css";

type PageProps = {
  id: string;
  locale: Locale;
  // Injected in tests (SPEC-089); the explorer client by default.
  explorer?: CompetitionExplorer;
};

// SPEC-089: the data, a failure (xornada.unavailable, D-9) or the explicit
// state that marcador.gal has no official data (CA-4/CA-5), always in text.
function Section<T>({
  result,
  locale,
  notOffered,
  children,
}: {
  result: CompetitionResult<T>;
  locale: Locale;
  notOffered:
    | "competitions.calendarNotOffered"
    | "competitions.standingsNotOffered";
  children: (data: T) => React.ReactNode;
}) {
  if (result.kind === "ok") return children(result.data);
  return (
    <p className={styles.emptyMessage}>
      {t(
        locale,
        result.kind === "notOffered" ? notOffered : "xornada.unavailable",
      )}
    </p>
  );
}

export async function CompetitionOverviewPage({
  id,
  locale,
  explorer,
}: PageProps) {
  if (!isAllowedCompetition(id)) {
    notFound();
  }

  const meta = getCompetitionMetadata(id);
  if (!meta) {
    notFound();
  }

  const [standings, calendar] = await Promise.all([
    loadCompetitionStandings(id, explorer),
    loadCompetitionCalendar(id, explorer),
  ]);

  const prefix = locale === "es" ? "/es" : "";

  return (
    <div className={styles.page} data-testid="competition-overview-page">
      <CompetitionNav locale={locale} currentCompetitionId={id} />
      <CompetitionHeader
        competition={meta}
        locale={locale}
        activeTab="overview"
      />

      <main className={styles.main}>
        {/* Standings preview */}
        <section>
          <div className={styles.sectionTitle}>
            <span>{t(locale, "competitions.standings")}</span>
            <a
              href={`${prefix}/clasificacion/${id}`}
              className={styles.viewAllLink}
            >
              {t(locale, "competitions.viewFullTable")} ›
            </a>
          </div>
          <Section
            result={standings}
            locale={locale}
            notOffered="competitions.standingsNotOffered"
          >
            {(data) => <StandingsTable standingsData={data} locale={locale} />}
          </Section>
        </section>

        {/* Calendar preview */}
        <section>
          <div className={styles.sectionTitle}>
            <span>{t(locale, "competitions.calendar")}</span>
            <a
              href={`${prefix}/calendario/${id}`}
              className={styles.viewAllLink}
            >
              {t(locale, "competitions.viewRounds")} ›
            </a>
          </div>
          <Section
            result={calendar}
            locale={locale}
            notOffered="competitions.calendarNotOffered"
          >
            {(data) => <CalendarView calendarData={data} locale={locale} />}
          </Section>
        </section>
      </main>
    </div>
  );
}

export async function CompetitionStandingsPage({
  id,
  locale,
  explorer,
}: PageProps) {
  if (!isAllowedCompetition(id)) {
    notFound();
  }

  const meta = getCompetitionMetadata(id);
  if (!meta) {
    notFound();
  }

  const standings = await loadCompetitionStandings(id, explorer);

  return (
    <div className={styles.page} data-testid="competition-standings-page">
      <CompetitionNav locale={locale} currentCompetitionId={id} />
      <CompetitionHeader
        competition={meta}
        locale={locale}
        activeTab="standings"
      />

      <main className={styles.main}>
        <section>
          <h2 className={styles.sectionTitle}>
            {t(locale, "competitions.standings")} · {meta.officialName}
          </h2>
          <Section
            result={standings}
            locale={locale}
            notOffered="competitions.standingsNotOffered"
          >
            {(data) => <StandingsTable standingsData={data} locale={locale} />}
          </Section>
        </section>
      </main>
    </div>
  );
}

export async function CompetitionCalendarPage({
  id,
  locale,
  explorer,
}: PageProps) {
  if (!isAllowedCompetition(id)) {
    notFound();
  }

  const meta = getCompetitionMetadata(id);
  if (!meta) {
    notFound();
  }

  const calendar = await loadCompetitionCalendar(id, explorer);

  return (
    <div className={styles.page} data-testid="competition-calendar-page">
      <CompetitionNav locale={locale} currentCompetitionId={id} />
      <CompetitionHeader
        competition={meta}
        locale={locale}
        activeTab="calendar"
      />

      <main className={styles.main}>
        <section>
          <h2 className={styles.sectionTitle}>
            {t(locale, "competitions.calendar")} · {meta.officialName}
          </h2>
          <Section
            result={calendar}
            locale={locale}
            notOffered="competitions.calendarNotOffered"
          >
            {(data) => <CalendarView calendarData={data} locale={locale} />}
          </Section>
        </section>
      </main>
    </div>
  );
}

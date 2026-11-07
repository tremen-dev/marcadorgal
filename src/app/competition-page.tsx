import { notFound } from "next/navigation";
import { CalendarView } from "../components/competition/CalendarView.tsx";
import { CompetitionHeader } from "../components/competition/CompetitionHeader.tsx";
import { StandingsTable } from "../components/competition/StandingsTable.tsx";
import { CompetitionNav } from "../components/navigation/CompetitionNav.tsx";
import { type Locale, t } from "../i18n/index.ts";
import {
  getOfficialCalendar,
  getStandings,
  type OfficialCalendarResponse,
  type StandingsResponse,
} from "../lib/explorer-client.ts";
import {
  getCompetitionMetadata,
  isAllowedCompetition,
} from "../model/index.ts";
import styles from "./CompetitionPage.module.css";

type PageProps = {
  id: string;
  locale: Locale;
};

export async function CompetitionOverviewPage({ id, locale }: PageProps) {
  if (!isAllowedCompetition(id)) {
    notFound();
  }

  const meta = getCompetitionMetadata(id);
  if (!meta) {
    notFound();
  }

  let standingsData: StandingsResponse | null = null;
  let calendarData: OfficialCalendarResponse | null = null;

  try {
    standingsData = await getStandings(id, "2026-27");
  } catch (_e) {
    // Graceful fallback if explorer endpoint is not accessible
  }

  try {
    calendarData = await getOfficialCalendar(id, "2026-27");
  } catch (_e) {
    // Graceful fallback
  }

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
              Ver táboa completa ›
            </a>
          </div>
          {standingsData && standingsData.standings.length > 0 ? (
            <StandingsTable standingsData={standingsData} locale={locale} />
          ) : (
            <p className={styles.emptyMessage}>
              {t(locale, "xornada.unavailable")}
            </p>
          )}
        </section>

        {/* Calendar preview */}
        <section>
          <div className={styles.sectionTitle}>
            <span>{t(locale, "competitions.calendar")}</span>
            <a
              href={`${prefix}/calendario/${id}`}
              className={styles.viewAllLink}
            >
              Ver xornadas ›
            </a>
          </div>
          {calendarData && calendarData.matches.length > 0 ? (
            <CalendarView calendarData={calendarData} locale={locale} />
          ) : (
            <p className={styles.emptyMessage}>
              {t(locale, "xornada.unavailable")}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

export async function CompetitionStandingsPage({ id, locale }: PageProps) {
  if (!isAllowedCompetition(id)) {
    notFound();
  }

  const meta = getCompetitionMetadata(id);
  if (!meta) {
    notFound();
  }

  let standingsData: StandingsResponse | null = null;
  try {
    standingsData = await getStandings(id, "2026-27");
  } catch (_e) {
    // Graceful fallback
  }

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
          {standingsData && standingsData.standings.length > 0 ? (
            <StandingsTable standingsData={standingsData} locale={locale} />
          ) : (
            <p className={styles.emptyMessage}>
              {t(locale, "xornada.unavailable")}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

export async function CompetitionCalendarPage({ id, locale }: PageProps) {
  if (!isAllowedCompetition(id)) {
    notFound();
  }

  const meta = getCompetitionMetadata(id);
  if (!meta) {
    notFound();
  }

  let calendarData: OfficialCalendarResponse | null = null;
  try {
    calendarData = await getOfficialCalendar(id, "2026-27");
  } catch (_e) {
    // Graceful fallback
  }

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
          {calendarData && calendarData.matches.length > 0 ? (
            <CalendarView calendarData={calendarData} locale={locale} />
          ) : (
            <p className={styles.emptyMessage}>
              {t(locale, "xornada.unavailable")}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

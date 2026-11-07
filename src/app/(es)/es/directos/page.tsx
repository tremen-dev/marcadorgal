import styles from "../../../../app/CompetitionPage.module.css";
import { DirectosView } from "../../../../components/directos/DirectosView.tsx";
import { getDayMatches } from "../../../../lib/explorer-client.ts";
import {
  type GroupedCompetitionMatches,
  transformExplorerMatches,
} from "../../../../lib/explorer-matches.ts";

export const dynamic = "force-dynamic";

function getTodayMadrid(): string {
  const d = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return d;
}

export default async function DirectosPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date = params.date || getTodayMadrid();

  let grouped: GroupedCompetitionMatches[] = [];
  try {
    const raw = await getDayMatches(date);
    grouped = transformExplorerMatches(raw);
  } catch (_e) {
    // Graceful fallback
  }

  return (
    <div className={styles.page} data-testid="directos-page">
      <main className={styles.main}>
        <DirectosView date={date} groupedCompetitions={grouped} locale="es" />
      </main>
    </div>
  );
}

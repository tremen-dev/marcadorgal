import { redirect } from "next/navigation";
import { nowInstant } from "@/clock";
import { DirectosView } from "@/components/directos/DirectosView";
import type { Locale } from "@/i18n";
import { type DirectosDeps, readDirectos } from "@/lib/directos";
import styles from "./CompetitionPage.module.css";

// SPEC-087: /directos and /es/directos, one day of the explorer export. The
// page is dynamic and cached by the CDN (next.config.ts, CA-6); an invalid
// ?date= is a temporary redirect to the path without query (CA-2), a failing
// explorer an "unavailable" state, never an empty day (CA-4, D-9).

export type DirectosSearchParams = Promise<{
  date?: string | string[];
}>;

export async function DirectosScreen({
  locale,
  searchParams,
  deps,
}: {
  locale: Locale;
  searchParams: DirectosSearchParams;
  // Tests only: the clock and the explorer client.
  deps?: DirectosDeps & { now?: string };
}) {
  const { date: raw } = await searchParams;
  const read = await readDirectos(raw, deps?.now ?? nowInstant(), locale, deps);
  if (read.kind === "redirect") redirect(read.location);
  return (
    <div className={styles.page} data-testid="directos-page">
      <main className={styles.main}>
        <DirectosView
          date={read.date}
          groupedCompetitions={read.kind === "page" ? read.grouped : []}
          unavailable={read.kind === "unavailable"}
          locale={locale}
        />
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { formatTime, type Locale, t } from "@/i18n";
import type { Instant } from "@/model";
import { snapshotFreshness } from "@/xornada/freshness";
import styles from "./Xornada.module.css";

// SPEC-027 CA-5 (H-4, D-9): the freshness line of a week page. No polling,
// no Realtime: the served instant, then its age by the browser clock.

const TICK_MS = 30_000;

export function SnapshotFreshness({
  locale,
  servedAt,
}: {
  locale: Locale;
  servedAt: Instant;
}) {
  // null on the server and in hydration: the served HTML says the time.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  const f = snapshotFreshness(Date.parse(servedAt), now);
  return (
    <p
      className={styles.freshness}
      data-testid="freshness"
      data-transport="snapshot"
    >
      <span data-testid="freshness-age">
        {f.key === "freshness.ago"
          ? t(locale, "freshness.ago", { n: f.n })
          : t(locale, "freshness.servedAt", {
              time: formatTime(servedAt, locale),
            })}
      </span>
    </p>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { leagueColor } from "../../design/league-color.ts";
import { type Locale, t } from "../../i18n/index.ts";
import {
  COMPETITIONS_METADATA,
  type CompetitionCategory,
} from "../../model/index.ts";
import styles from "./CompetitionNav.module.css";

type Props = {
  locale: Locale;
  currentCompetitionId?: string;
  initialCategory?: "all" | CompetitionCategory;
};

export function CompetitionNav({
  locale,
  currentCompetitionId,
  initialCategory = "all",
}: Props) {
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | CompetitionCategory
  >(initialCategory);
  const pathname = usePathname();

  const prefix = locale === "es" ? "/es" : "";
  const allCompetitions = Object.values(COMPETITIONS_METADATA);

  const filteredCompetitions =
    selectedCategory === "all"
      ? allCompetitions
      : allCompetitions.filter((c) => c.category === selectedCategory);

  return (
    <div className={styles.wrapper} data-testid="competition-nav">
      {/* Category Filter Tabs */}
      <div
        className={styles.categoryBar}
        role="tablist"
        aria-label={t(locale, "competitions.title")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategory === "all"}
          className={`${styles.categoryTab} ${
            selectedCategory === "all" ? styles.categoryActive : ""
          }`}
          onClick={() => setSelectedCategory("all")}
          data-testid="tab-all"
        >
          {t(locale, "competitions.all")}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={selectedCategory === "femenino"}
          className={`${styles.categoryTab} ${
            selectedCategory === "femenino" ? styles.categoryActive : ""
          }`}
          onClick={() => setSelectedCategory("femenino")}
          data-testid="tab-women"
        >
          {t(locale, "competitions.women")}
          <span className={styles.femBadge}>Novo</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={selectedCategory === "masculino"}
          className={`${styles.categoryTab} ${
            selectedCategory === "masculino" ? styles.categoryActive : ""
          }`}
          onClick={() => setSelectedCategory("masculino")}
          data-testid="tab-men"
        >
          {t(locale, "competitions.men")}
        </button>
      </div>

      {/* Leagues Quick Links Scroll */}
      <div className={styles.leaguesScroll}>
        {filteredCompetitions.map((comp) => {
          const isActive =
            currentCompetitionId === comp.id || pathname?.includes(comp.id);
          const href = `${prefix}/competicion/${comp.id}`;

          return (
            <a
              key={comp.id}
              href={href}
              className={`${styles.leaguePill} ${isActive ? styles.leagueActive : ""}`}
              data-competition-id={comp.id}
              data-category={comp.category}
            >
              <span
                className={styles.leagueDot}
                style={{ backgroundColor: leagueColor(comp.id) }}
                aria-hidden="true"
              />
              <span>{comp.shortName}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

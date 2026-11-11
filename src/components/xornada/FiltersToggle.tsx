"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { type Locale, t } from "@/i18n";
import {
  ALL_COMPETITION_IDS,
  getStoredVisibleCompetitions,
  LEAGUES_PREFERENCE_EVENT,
} from "@/lib/league-preferences";
import {
  activeFilterCount,
  parseFragment,
  type XornadaState,
} from "@/xornada/filter";
import {
  FILTER_STATE_EVENT,
  FILTERS_PANEL_ID,
  FILTERS_TOGGLE_ID,
  filtersOpen,
  filtersOpenOnServer,
  setFiltersOpen,
  subscribeFiltersOpen,
} from "./filters-panel";
import styles from "./Xornada.module.css";

const hiddenOf = (visible: readonly string[] | null): string[] =>
  visible === null
    ? []
    : ALL_COMPETITION_IDS.filter((id) => !visible.includes(id));

function nameOf(locale: Locale, n: number): string {
  if (n === 0) return t(locale, "xornada.filters");
  return n === 1
    ? t(locale, "xornada.filtersActive.one", { n })
    : t(locale, "xornada.filtersActive.other", { n });
}

// SPEC-082 CA-3, CA-5: on mobile, the pills and «Ligas» fold behind this
// button, at the right of the bar (where gl·es was). Its badge says how
// many filters are on; its name says it too, never the colour alone
// (ADR-005). On desktop it is not painted (CSS) and the panel is always
// shown.
export function FiltersToggle({ locale }: { locale: Locale }) {
  const open = useSyncExternalStore(
    subscribeFiltersOpen,
    filtersOpen,
    filtersOpenOnServer,
  );
  const [filter, setFilter] = useState<XornadaState["filter"]>(null);
  const [hidden, setHidden] = useState<readonly string[]>([]);

  useEffect(() => {
    setFilter(parseFragment(window.location.hash, []).filter);
    setHidden(hiddenOf(getStoredVisibleCompetitions()));
    const onState = (event: Event) => {
      const state = (event as CustomEvent<XornadaState>).detail;
      if (state) setFilter(state.filter);
    };
    const onHash = () =>
      setFilter(parseFragment(window.location.hash, []).filter);
    const onLeagues = (event: Event) => {
      const ids = (event as CustomEvent<readonly string[]>).detail;
      setHidden(hiddenOf(Array.isArray(ids) ? ids : null));
    };
    document.addEventListener(FILTER_STATE_EVENT, onState);
    window.addEventListener("hashchange", onHash);
    window.addEventListener(LEAGUES_PREFERENCE_EVENT, onLeagues);
    return () => {
      document.removeEventListener(FILTER_STATE_EVENT, onState);
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener(LEAGUES_PREFERENCE_EVENT, onLeagues);
    };
  }, []);

  const n = activeFilterCount({ day: null, filter }, hidden);
  return (
    <button
      type="button"
      id={FILTERS_TOGGLE_ID}
      className={styles.filtersToggle}
      aria-expanded={open}
      aria-controls={FILTERS_PANEL_ID}
      aria-label={nameOf(locale, n)}
      onClick={() => setFiltersOpen(!open)}
      data-testid="filters-toggle"
    >
      <svg
        className={styles.filtersIcon}
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M3 5.5h14M5.5 10h9M8 14.5h4" />
      </svg>
      {n > 0 && (
        <span
          className={styles.filtersBadge}
          aria-hidden="true"
          data-testid="filters-badge"
        >
          {n}
        </span>
      )}
    </button>
  );
}

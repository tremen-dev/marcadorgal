"use client";

import { useEffect } from "react";
import {
  applyVisibleCompetitionsToDom,
  getStoredVisibleCompetitions,
  LEAGUES_PREFERENCE_EVENT,
} from "@/lib/league-preferences";
import {
  competitionCounts,
  countFilters,
  EMPTY_STATE,
  emptyReason,
  formatCount,
  fragmentOf,
  parseFragment,
  rowMatches,
  toggleDay,
  withFilter,
  type XornadaFilter,
  type XornadaState,
} from "@/xornada/filter";
import { provisionalLegendShown } from "@/xornada/qualifier";
import { FILTER_STATE_EVENT } from "./filters-panel";

// SPEC-023 CA-6 (amended by SPEC-024 H-1): the filter component of the
// screen, next to XornadaLive. It renders nothing: it reads the fragment and
// hides rows and sections with `hidden` over the rendered HTML and keeps the
// links' fragments in step. SPEC-040 CA-4 (H-5): no sidebar left to follow
// or to jump from. Without JavaScript the HTML is the whole xornada.

// SPEC-024 CA-5: XornadaLive fires it after every repaint; the fragment is
// applied again and stays as it is.
export const REPAINT_EVENT = "xornada:repaint";

const ROWS = "li[data-day]";

const filterOf = (link: HTMLElement): XornadaFilter | null => {
  const value = link.dataset.filterLink;
  return value === "live" || value === "finished" ? value : null;
};

// A link to the empty state must still be a fragment: "" would reload.
const hrefOf = (state: XornadaState): string => fragmentOf(state) || "#";

function setCurrent(link: HTMLElement, current: boolean): void {
  if (current) link.setAttribute("aria-current", "true");
  else link.removeAttribute("aria-current");
}

function apply(root: HTMLElement, state: XornadaState): void {
  const rows = [...root.querySelectorAll<HTMLElement>(ROWS)].map((el) => ({
    el,
    status: el.dataset.status ?? "",
    day: el.dataset.day ?? "",
  }));
  for (const row of rows) row.el.hidden = !rowMatches(row, state);

  const sections: { userHidden: boolean; anyMatch: boolean }[] = [];
  for (const section of root.querySelectorAll<HTMLElement>(
    "section[data-competition]",
  )) {
    const userHidden = section.getAttribute("data-user-hidden") === "true";
    const anyMatch = [...section.querySelectorAll<HTMLElement>(ROWS)].some(
      (row) => !row.hidden,
    );
    section.hidden = userHidden || !anyMatch;
    sections.push({ userHidden, anyMatch });
  }
  // F-4: each header's count (SPEC-040 CA-4) follows the state.
  for (const section of root.querySelectorAll<HTMLElement>(
    "section[data-competition]",
  )) {
    const id = section.dataset.competition ?? "";
    const counts = competitionCounts(
      rows.filter(({ el }) => section.contains(el)),
      state,
    );
    for (const el of root.querySelectorAll<HTMLElement>(
      "[data-competition-count]",
    )) {
      if (el.dataset.competitionCount !== id) continue;
      const live = el.dataset.show === "live";
      const n = live ? counts.live : counts.matching;
      el.hidden = live ? counts.live === 0 : counts.live > 0;
      for (const number of el.querySelectorAll<HTMLElement>("[data-n]"))
        number.textContent = String(n);
      for (const label of el.querySelectorAll<HTMLElement>("[data-label-one]"))
        label.textContent = formatCount(
          {
            one: label.dataset.labelOne ?? "",
            other: label.dataset.labelOther ?? "",
          },
          n,
        );
    }
  }

  // SPEC-083 CA-4: the empty state says whether the leagues or the status
  // filter left nothing.
  const empty = root.querySelector<HTMLElement>("[data-xornada-empty]");
  if (empty) {
    const reason = emptyReason(sections);
    empty.hidden = reason === null;
    if (reason !== null) {
      const text =
        reason === "leagues"
          ? empty.dataset.emptyLeagues
          : empty.dataset.emptyFilter;
      if (text !== undefined && empty.textContent !== text)
        empty.textContent = text;
      empty.dataset.emptyReason = reason;
    }
  }

  // SPEC-034 CA-3: the legend of the mark follows the visible rows (a folded
  // competition still counts: folding does not hide its rows). It is only
  // rendered in `mark`.
  const legend = root.querySelector<HTMLElement>("[data-provisional-legend]");
  if (legend)
    legend.hidden = !provisionalLegendShown(
      "mark",
      rows
        .filter(({ el }) => !el.hidden)
        .map(({ el }) => el.dataset.qualifier ?? ""),
    );

  for (const link of root.querySelectorAll<HTMLAnchorElement>(
    "a[data-day-link]",
  )) {
    const day = link.dataset.dayLink ?? "";
    setCurrent(link, day === state.day);
    link.setAttribute("href", hrefOf(toggleDay(state, day)));
  }
  for (const link of root.querySelectorAll<HTMLAnchorElement>(
    "a[data-filter-link]",
  )) {
    const filter = filterOf(link);
    setCurrent(link, filter === state.filter);
    link.setAttribute("href", hrefOf(withFilter(state, filter)));
  }

  const counts = countFilters(rows, state.day);
  for (const el of root.querySelectorAll<HTMLElement>("[data-count]")) {
    const key = el.dataset.count as keyof typeof counts;
    if (key in counts) el.textContent = String(counts[key]);
  }

  // gl·es keeps the fragment (CA-4). SPEC-082 CA-2: it lives in the footer,
  // outside the screen, so it is looked up in the whole document.
  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    "a[data-locale-href]",
  )) {
    link.setAttribute("href", `${link.dataset.localeHref}${fragmentOf(state)}`);
  }
}

export function XornadaFilters() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-xornada]");
    if (!root) return;
    const days = (): string[] =>
      [...root.querySelectorAll<HTMLElement>("a[data-day-link]")].map(
        (link) => link.dataset.dayLink ?? "",
      );
    let state: XornadaState = EMPTY_STATE;
    const set = (next: XornadaState) => {
      state = next;
      apply(root, state);
      // SPEC-082 CA-5: the filters button counts the status pill.
      document.dispatchEvent(
        new CustomEvent(FILTER_STATE_EVENT, { detail: state }),
      );
    };
    const fromHash = () => set(parseFragment(window.location.hash, days()));
    // SPEC-083 CA-4: the leagues are on the sections before the empty state
    // is decided, whichever component's effect runs first: on load (the
    // stored preference) and on every change (the event's list).
    const onLeagues = (event: Event) => {
      const ids = (event as CustomEvent<readonly string[]>).detail;
      if (Array.isArray(ids)) applyVisibleCompetitionsToDom(ids, root);
      fromHash();
    };
    const stored = getStoredVisibleCompetitions();
    if (stored) applyVisibleCompetitionsToDom(stored, root);

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element | null)?.closest<HTMLElement>(
        "a[data-day-link], a[data-filter-link]",
      );
      if (!link || !root.contains(link)) return;
      event.preventDefault();
      const next =
        link.dataset.dayLink !== undefined
          ? toggleDay(state, link.dataset.dayLink)
          : withFilter(state, filterOf(link));
      // Only the fragment changes: no reload, nothing asked of the network.
      const { pathname, search } = window.location;
      window.history.replaceState(
        null,
        "",
        `${pathname}${search}${fragmentOf(next)}`,
      );
      set(next);
    };

    root.addEventListener("click", onClick);
    window.addEventListener("hashchange", fromHash);
    document.addEventListener(REPAINT_EVENT, fromHash);
    window.addEventListener(LEAGUES_PREFERENCE_EVENT, onLeagues);
    fromHash();
    return () => {
      root.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", fromHash);
      document.removeEventListener(REPAINT_EVENT, fromHash);
      window.removeEventListener(LEAGUES_PREFERENCE_EVENT, onLeagues);
    };
  }, []);
  return null;
}

"use client";

import { useEffect } from "react";
import {
  competitionCounts,
  countFilters,
  EMPTY_STATE,
  formatCount,
  fragmentOf,
  parseFragment,
  rowMatches,
  toggleDay,
  withFilter,
  type XornadaFilter,
  type XornadaState,
} from "@/xornada/filter";

// SPEC-023 CA-6: the one client component of the screen. It renders nothing:
// it reads the fragment and hides rows and sections with `hidden` over the
// served HTML, keeps the links' fragments in step and folds a competition
// from the sidebar. Without JavaScript the HTML is the whole xornada.

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

  let anyVisible = false;
  for (const section of root.querySelectorAll<HTMLElement>(
    "section[data-competition]",
  )) {
    const visible = [...section.querySelectorAll<HTMLElement>(ROWS)].some(
      (row) => !row.hidden,
    );
    section.hidden = !visible;
    anyVisible ||= visible;
  }
  // F-4: the sidebar numbers and each header's live pill follow the state.
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

  const empty = root.querySelector<HTMLElement>("[data-xornada-empty]");
  if (empty) empty.hidden = anyVisible;

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

  // gl·es keeps the fragment (CA-4).
  for (const link of root.querySelectorAll<HTMLAnchorElement>(
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
    };
    const fromHash = () => set(parseFragment(window.location.hash, days()));

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
        "a[data-day-link], a[data-filter-link], a[data-competition-toggle]",
      );
      if (!link || !root.contains(link)) return;
      event.preventDefault();
      if (link.dataset.competitionToggle !== undefined) {
        const details = document.getElementById(
          link.getAttribute("aria-controls") ?? "",
        );
        if (details instanceof HTMLDetailsElement) details.open = !details.open;
        return;
      }
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

    // Folding from the summary or the sidebar keeps the sidebar in step.
    const onToggle = (event: Event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement)) return;
      for (const entry of root.querySelectorAll<HTMLElement>(
        "a[data-competition-toggle]",
      )) {
        if (entry.getAttribute("aria-controls") === details.id)
          entry.setAttribute("aria-expanded", String(details.open));
      }
    };

    root.addEventListener("click", onClick);
    root.addEventListener("toggle", onToggle, true);
    window.addEventListener("hashchange", fromHash);
    fromHash();
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("toggle", onToggle, true);
      window.removeEventListener("hashchange", fromHash);
    };
  }, []);
  return null;
}

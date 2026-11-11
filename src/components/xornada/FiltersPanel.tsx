"use client";

import { type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";
import {
  FILTERS_PANEL_ID,
  filtersOpen,
  filtersOpenOnServer,
  foldFilters,
  subscribeFiltersOpen,
} from "./filters-panel";
import styles from "./Xornada.module.css";

const inDialog = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest('[role="dialog"]') !== null;

// SPEC-082 CA-4: the pills and «Ligas» (SPEC-023 CA-3, SPEC-057). On
// mobile they are folded until FiltersToggle opens them, in flow under the
// title row; choosing a pill folds them again with the focus on the button,
// and so does Escape. «Ligas» opens its dialog and leaves the panel open.
export function FiltersPanel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const open = useSyncExternalStore(
    subscribeFiltersOpen,
    filtersOpen,
    filtersOpenOnServer,
  );
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = ref.current;
    if (!nav || !open) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("a[data-filter-link]") !== null &&
        !inDialog(target)
      )
        foldFilters();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || inDialog(event.target)) return;
      foldFilters();
    };
    nav.addEventListener("click", onClick);
    nav.addEventListener("keydown", onKey);
    return () => {
      nav.removeEventListener("click", onClick);
      nav.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <nav
      ref={ref}
      id={FILTERS_PANEL_ID}
      className={styles.filters}
      aria-label={label}
      data-open={open ? "true" : undefined}
      data-testid="filters"
    >
      {children}
    </nav>
  );
}

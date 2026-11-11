// SPEC-082 CA-4: whether the folded filters panel (mobile) is open. One
// module store shared by the button in the bar (FiltersToggle) and the panel
// under the title (FiltersPanel), which live in different parts of the
// screen. Never in the URL nor in localStorage: every load starts folded.

export const FILTERS_PANEL_ID = "xornada-filters";
export const FILTERS_TOGGLE_ID = "xornada-filters-toggle";

// SPEC-082 CA-5: XornadaFilters tells the button the state it applied (the
// pills change the fragment with replaceState, which fires no hashchange).
export const FILTER_STATE_EVENT = "xornada:filter-state";

let open = false;
const listeners = new Set<() => void>();

export function subscribeFiltersOpen(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const filtersOpen = (): boolean => open;

// The server always paints it folded.
export const filtersOpenOnServer = (): boolean => false;

export function setFiltersOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
}

// Folds the panel and gives the focus back to the button.
export function foldFilters(): void {
  setFiltersOpen(false);
  document.getElementById(FILTERS_TOGGLE_ID)?.focus();
}

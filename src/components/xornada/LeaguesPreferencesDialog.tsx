"use client";

import { useEffect, useId, useState } from "react";
import { type Locale, t } from "@/i18n";
import {
  ALL_COMPETITION_IDS,
  applyVisibleCompetitionsToDom,
  getStoredVisibleCompetitions,
  KNOWN_COMPETITIONS,
  LEAGUES_PREFERENCE_EVENT,
  PRESET_IDS,
  saveStoredVisibleCompetitions,
} from "@/lib/league-preferences";
import styles from "./Xornada.module.css";

export function LeaguesPreferencesTrigger({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(ALL_COMPETITION_IDS),
  );
  const titleId = useId();

  // Load from localStorage on mount and apply to DOM
  useEffect(() => {
    const stored = getStoredVisibleCompetitions();
    if (stored && stored.length > 0) {
      const set = new Set(stored);
      setSelectedIds(set);
      applyVisibleCompetitionsToDom(stored);
    }
  }, []);

  // Sync external changes
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<readonly string[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setSelectedIds(new Set(customEvent.detail));
        applyVisibleCompetitionsToDom(customEvent.detail);
      }
    };
    window.addEventListener(LEAGUES_PREFERENCE_EVENT, handler);
    return () => {
      window.removeEventListener(LEAGUES_PREFERENCE_EVENT, handler);
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const updateSelection = (nextIds: readonly string[]) => {
    if (nextIds.length === 0) return;
    setSelectedIds(new Set(nextIds));
    saveStoredVisibleCompetitions(nextIds);
    applyVisibleCompetitionsToDom(nextIds);
  };

  const toggle = (id: string) => {
    if (selectedIds.has(id)) {
      if (selectedIds.size <= 1) return; // Prevent 0 competitions
      const next = [...selectedIds].filter((x) => x !== id);
      updateSelection(next);
    } else {
      const next = [...selectedIds, id];
      updateSelection(next);
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.pillPreferences}
        onClick={() => setOpen(true)}
        data-testid="leagues-preferences-trigger"
        aria-label={t(locale, "competitions.preferencesTitle")}
        aria-haspopup="dialog"
      >
        <span className={styles.pillPreferencesIcon} aria-hidden="true">
          ⚙
        </span>
        <span>{t(locale, "competitions.preferencesButton")}</span>
      </button>

      {open && (
        <div className={styles.dialogOverlay}>
          <button
            type="button"
            className={styles.dialogBackdrop}
            aria-label={t(locale, "competitions.close")}
            onClick={() => setOpen(false)}
            tabIndex={-1}
          />
          <div
            className={styles.dialogCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid="leagues-preferences-dialog"
          >
            <div className={styles.dialogHeader}>
              <div>
                <h2 id={titleId} className={styles.dialogTitle}>
                  {t(locale, "competitions.preferencesTitle")}
                </h2>
                <p className={styles.dialogSubtitle}>
                  {t(locale, "competitions.preferencesSubtitle")}
                </p>
              </div>
              <button
                type="button"
                className={styles.dialogClose}
                onClick={() => setOpen(false)}
                data-testid="preferences-close"
                aria-label={t(locale, "competitions.close")}
              >
                ✕
              </button>
            </div>

            <div
              className={styles.presetsBar}
              role="toolbar"
              aria-label={t(locale, "competitions.presetsLabel")}
            >
              <button
                type="button"
                className={styles.presetButton}
                onClick={() => updateSelection(PRESET_IDS.all)}
                data-testid="preset-all"
              >
                {t(locale, "competitions.presetAll")}
              </button>
              <button
                type="button"
                className={styles.presetButton}
                onClick={() => updateSelection(PRESET_IDS.women)}
                data-testid="preset-women"
              >
                {t(locale, "competitions.presetWomen")}
              </button>
              <button
                type="button"
                className={styles.presetButton}
                onClick={() => updateSelection(PRESET_IDS.modest)}
                data-testid="preset-modest"
              >
                {t(locale, "competitions.presetModest")}
              </button>
              <button
                type="button"
                className={styles.presetButton}
                onClick={() => updateSelection(PRESET_IDS.pro)}
                data-testid="preset-pro"
              >
                {t(locale, "competitions.presetPro")}
              </button>
            </div>

            <ul className={styles.competitionsList}>
              {KNOWN_COMPETITIONS.map((comp) => {
                const checked = selectedIds.has(comp.id);
                const disabled = checked && selectedIds.size <= 1;
                return (
                  <li key={comp.id} className={styles.competitionItem}>
                    <label className={styles.switchLabel}>
                      <span className={styles.itemMeta}>
                        <span
                          className={styles.leagueDot}
                          style={{ backgroundColor: comp.color }}
                          aria-hidden="true"
                        />
                        <span className={styles.itemName}>
                          {t(locale, comp.nameKey)}
                        </span>
                        {comp.featuredBadge && (
                          <span className={styles.itemBadge}>
                            · {comp.featuredBadge}
                          </span>
                        )}
                      </span>
                      <input
                        type="checkbox"
                        className={styles.switchInput}
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(comp.id)}
                        data-testid={`toggle-competition-${comp.id}`}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>

            {selectedIds.size <= 1 && (
              <p className={styles.dialogNotice}>
                {t(locale, "competitions.atLeastOne")}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

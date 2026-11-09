import styles from "./Wordmark.module.css";

// SPEC-065 CA-3 (ADR-029 §3): «marcador», the block, «gal»; the block is
// drawn, not a glyph: the bar of the icon (8 × 19, radius 2.5 on the 48 grid) in em, so
// it follows the parent's size. Decorative: the link around it carries the
// accessible name. The weight and tracking are the parent's.
export function Wordmark() {
  return (
    <>
      marcador
      <span className={styles.block} aria-hidden="true" />
      gal
    </>
  );
}

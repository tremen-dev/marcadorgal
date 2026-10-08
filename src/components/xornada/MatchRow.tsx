import { formatTime, type Locale, t } from "@/i18n";
import { minuteLabel, type XornadaRow } from "@/xornada/view";
import styles from "./Xornada.module.css";

type Props = { row: XornadaRow; locale: Locale };

const cx = (...names: (string | false | null | undefined)[]): string =>
  names.filter(Boolean).join(" ");

// ADR-005: ember only for live; amber for what awaits a person (postponed,
// suspended, provisional); red for sen sinal. Every colour has its label.
function marginColor(row: XornadaRow): string | undefined {
  if (row.qualifier === "sen_sinal" && row.status === "live") return styles.red;
  if (row.status === "live") return styles.ember;
  if (row.status === "postponed" || row.status === "suspended")
    return styles.amber;
  return undefined;
}

function qualifierColor(row: XornadaRow): string {
  return row.qualifier === "sen_sinal" ? styles.red : styles.amber;
}

export function MatchRow({ row, locale }: Props) {
  const isLive = row.status === "live";
  const noSignal = row.qualifier === "sen_sinal";
  const { margin } = row;
  const marginText =
    margin.kind === "time"
      ? formatTime(margin.kickoff, locale)
      : margin.kind === "minute"
        ? minuteLabel(margin)
        : margin.kind === "halfTime"
          ? t(locale, "xornada.halfTime")
          : t(locale, row.statusKey);
  // SPEC-021 H-2: at half-time there is no minute to run, so no live dot;
  // the ember inset still says the match is in play.
  const showDot = isLive && !noSignal && margin.kind !== "halfTime";
  const dimNames = row.status === "postponed";
  const nameClass = (side: "home" | "away") =>
    cx(
      styles.team,
      row.winner === side && styles.winner,
      row.winner !== null && row.winner !== side && styles.loser,
      dimNames && styles.dim,
    );
  const scoreClass = (side: "home" | "away") =>
    cx(
      styles.score,
      row.score === null && styles.scoreEmpty,
      row.score !== null && noSignal && styles.scoreNoSignal,
      row.winner !== null && row.winner !== side && styles.loser,
    );
  const scoreText = (side: "home" | "away") =>
    row.score === null ? "–" : String(row.score[side]);

  return (
    <li
      className={cx(
        styles.row,
        isLive && !noSignal && styles.live,
        noSignal && styles.noSignal,
      )}
      data-testid="match-row"
      data-match-id={row.matchId}
      data-status={row.status}
      data-qualifier={row.qualifier}
    >
      <div className={styles.margin}>
        <span
          className={cx(
            styles.marginMain,
            margin.kind === "minute" && styles.marginMinute,
            marginColor(row),
          )}
          data-testid="match-margin"
        >
          {showDot && <span className={styles.dot} aria-hidden="true" />}
          {marginText}
        </span>
        {margin.kind !== "status" && (
          <span className={styles.srOnly}>{t(locale, row.statusKey)}</span>
        )}
        {row.qualifierKey && (
          <span
            className={cx(styles.qualifier, qualifierColor(row))}
            data-testid="match-qualifier"
          >
            {t(locale, row.qualifierKey)}
          </span>
        )}
      </div>
      <div className={styles.sides}>
        <span className={nameClass("home")} data-testid="team-name">
          {row.home}
        </span>
        <span className={scoreClass("home")} data-testid="score">
          {scoreText("home")}
        </span>
        <span className={nameClass("away")} data-testid="team-name">
          {row.away}
        </span>
        <span className={scoreClass("away")} data-testid="score">
          {scoreText("away")}
        </span>
      </div>
    </li>
  );
}

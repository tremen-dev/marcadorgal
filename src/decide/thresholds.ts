// Every number of the engine, with the rule that fixes it (ADR-004).

// RN-01: an observation older than this never wins anything. Age is measured
// with observedAt, the source's own clock (H-6, RN-11).
export const OBSERVATION_WINDOW_MINUTES = 5;

// RN-04: two sources of equal or adjacent priority may disagree this long
// before the conflict is declared and the current Decision is held.
export const CONFLICT_GRACE_MINUTES = 3;

// RN-05: a live match with no observation from any source for this long goes
// to sen_sinal and opens an Alert.
export const SILENCE_MINUTES = 15;

// RN-02: nobody closed the match, so the engine does, provisional and with a
// forced_finish Alert (H-3, H-5).
export const FORCED_FINISH_MINUTES = 120;

// RN-02: scheduled -> live is only believed this close to kickoff.
export const KICKOFF_GRACE_MINUTES = 15;

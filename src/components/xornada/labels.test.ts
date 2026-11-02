import { describe, expect, it } from "vitest";
import type { XornadaDay } from "@/xornada/view";
import {
  dayLabel,
  liveCountLabel,
  matchCountLabel,
  rowDateLabel,
} from "./labels";

// SPEC-040 CA-2 (was SPEC-033 CA-2's day header): the date of a row, always
// with its month; today in capitals, as in the strip.
describe("SPEC-040 CA-2 rowDateLabel", () => {
  const saturday = {
    date: "2026-10-11",
    weekdayKey: "weekday.sat",
    dayOfMonth: 11,
    monthKey: "month.oct",
  } as const;

  it("«sáb 11 out» / «sáb 11 oct»", () => {
    expect(rowDateLabel(saturday, false, "gl")).toBe("sáb 11 out");
    expect(rowDateLabel(saturday, false, "es")).toBe("sáb 11 oct");
  });

  it("today in capitals: «SÁB 11 OUT»", () => {
    expect(rowDateLabel(saturday, true, "gl")).toBe("SÁB 11 OUT");
    expect(rowDateLabel(saturday, true, "es")).toBe("SÁB 11 OCT");
  });
});

const day = (over: Partial<XornadaDay>): XornadaDay => ({
  date: "2026-10-09",
  weekdayKey: "weekday.fri",
  dayOfMonth: 9,
  monthKey: "month.oct",
  otherMonth: false,
  today: false,
  ...over,
});

// SPEC-023 CA-2 and iteration 2 (B-2): the label of a day of the strip.
describe("SPEC-023 dayLabel", () => {
  it("weekday and day of the month: «ven 9» / «vie 9»", () => {
    expect(dayLabel(day({}), "gl")).toBe("ven 9");
    expect(dayLabel(day({}), "es")).toBe("vie 9");
  });

  it("today in capitals: «VEN 9»", () => {
    expect(dayLabel(day({ today: true }), "gl")).toBe("VEN 9");
  });

  it("B-2: the month when it is not the month of today: «sáb 12 set» / «sáb 12 sep»", () => {
    const september = day({
      date: "2026-09-12",
      weekdayKey: "weekday.sat",
      dayOfMonth: 12,
      monthKey: "month.sep",
      otherMonth: true,
    });
    expect(dayLabel(september, "gl")).toBe("sáb 12 set");
    expect(dayLabel(september, "es")).toBe("sáb 12 sep");
  });
});

// Iteration 2 (V-1, B-3): the counts of the sidebar, visible in words.
describe("SPEC-023 count labels", () => {
  it("B-3: «1 partido», «N partidos» in gl and es", () => {
    expect(matchCountLabel("gl", 1)).toBe("1 partido");
    expect(matchCountLabel("es", 1)).toBe("1 partido");
    expect(matchCountLabel("gl", 11)).toBe("11 partidos");
    expect(matchCountLabel("es", 0)).toBe("0 partidos");
  });

  it("V-1: the live count says so: «2 en xogo» / «2 en juego»", () => {
    expect(liveCountLabel("gl", 2)).toBe("2 en xogo");
    expect(liveCountLabel("es", 1)).toBe("1 en juego");
  });
});

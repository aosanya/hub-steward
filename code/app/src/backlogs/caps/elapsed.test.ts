import type { IssueNote } from "../issueNotes";
import { elapsedSeconds, startedAtOf } from "./elapsed";
import { lineOf } from "./capsFigures";
import type { CapsReading } from "./api";

const note = (kind: IssueNote["kind"], at: string, automatic = false): IssueNote => ({ id: at, author: "", kind, text: "", links: [], at, automatic });

const caps = { input: 1000, output: 400, runtimeSeconds: 900 };
const reading: CapsReading = { inForce: caps, standard: caps, own: null, used: { input: 0, output: 0, seconds: 0, clockStopped: false } };

describe("the runtime of a running issue is worked out from its Log", () => {
  it("starts at the first worker entry", () => {
    const started = startedAtOf([note("person", "2026-11-11T20:00:00Z"), note("worker", "2026-11-11T20:10:00Z"), note("worker", "2026-11-11T20:05:00Z")]);
    expect(started).toBe(new Date("2026-11-11T20:05:00Z").getTime());
  });

  it("does not start at the hub's own automatic notes", () => {
    const started = startedAtOf([note("worker", "2026-11-11T19:00:00Z", true), note("worker", "2026-11-11T20:05:00Z")]);
    expect(started).toBe(new Date("2026-11-11T20:05:00Z").getTime());
  });

  it("has no start while no worker has written", () => {
    expect(startedAtOf([note("person", "2026-11-11T20:00:00Z")])).toBeNull();
  });

  it("counts whole seconds from the start to now", () => {
    expect(elapsedSeconds(1_000, 66_900)).toBe(65);
  });

  it("never counts below zero", () => {
    expect(elapsedSeconds(5_000, 1_000)).toBe(0);
  });

  it("shows the elapsed seconds on the runtime line instead of the stored ones", () => {
    expect(lineOf(reading, "runtimeSeconds", 65).figure).toBe("1:05 / 15:00");
  });

  it("marks the runtime line passed when the elapsed time reaches the cap", () => {
    expect(lineOf(reading, "runtimeSeconds", 900).passed).toBe(true);
  });

  it("keeps the stored seconds when no elapsed time is given", () => {
    expect(lineOf({ ...reading, used: { ...reading.used!, seconds: 30 } }, "runtimeSeconds").figure).toBe("0:30 / 15:00");
  });
});

import { strongerTint, tintOfElapsed } from "./capTint";

describe("a running issue shows its time left and is shaded redder as it runs out", () => {
  it("shows the minutes left but no shade before half the time is gone", () => {
    expect(tintOfElapsed(300, 900)).toEqual({ tint: 0, chip: "10 min left", danger: false });
  });

  it("starts pale at half the time", () => {
    expect(tintOfElapsed(450, 900).tint).toBe(0.2);
  });

  it("gets redder as the time goes", () => {
    expect(tintOfElapsed(700, 900).tint).toBeGreaterThan(tintOfElapsed(500, 900).tint);
  });

  it("counts the last minute in seconds", () => {
    expect(tintOfElapsed(870, 900).chip).toBe("30 s left");
  });

  it("is fully red with the danger mark once the time is up", () => {
    expect(tintOfElapsed(900, 900)).toEqual({ tint: 1, chip: "Time is up", danger: true });
  });

  it("keeps the stronger of two tints", () => {
    const token = { tint: 0.9, chip: "Input 95%", danger: true };
    expect(strongerTint(token, tintOfElapsed(500, 900))).toBe(token);
    expect(strongerTint(null, tintOfElapsed(500, 900))?.chip).toBe("7 min left");
  });
});

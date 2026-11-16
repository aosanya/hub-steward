import type { CapsReading } from "./api";
import { tintOf } from "./capTint";

const caps = { input: 1000, output: 400, runtimeSeconds: 900 };

const reading = (used: { input?: number; output?: number; seconds?: number } | null): CapsReading => ({
  inForce: caps,
  standard: caps,
  own: null,
  used: used === null ? null : { input: used.input ?? 0, output: used.output ?? 0, seconds: used.seconds ?? 0, clockStopped: false },
});

describe("the tint of a card follows the nearest cap", () => {
  it("has none when no worker has run", () => {
    expect(tintOf(reading(null))).toBeNull();
  });

  it("has none below half used", () => {
    expect(tintOf(reading({ input: 499, output: 100, seconds: 100 }))).toBeNull();
  });

  it("is 20% of full red at half used and names the cap", () => {
    expect(tintOf(reading({ output: 200 }))).toEqual({ tint: 0.2, chip: "Output 50%", danger: false });
  });

  it("is 68% at 80% used with red text", () => {
    const found = tintOf(reading({ seconds: 720 }))!;
    expect(found.tint).toBeCloseTo(0.68, 10);
    expect(found).toMatchObject({ chip: "Runtime 80%", danger: true });
  });

  it("is full red at the cap and reads passed", () => {
    expect(tintOf(reading({ input: 1000 }))).toEqual({ tint: 1, chip: "Input passed", danger: true });
  });

  it("never goes past full red", () => {
    expect(tintOf(reading({ input: 5000 }))!.tint).toBe(1);
  });

  it("follows the highest ratio of the three, the one the Caps card marks Nearest", () => {
    expect(tintOf(reading({ input: 600, output: 360, seconds: 100 }))).toMatchObject({ chip: "Output 90%" });
  });
});

import { nearestOf } from "./api";
import { interruptedTint } from "./capTint";

describe("an issue the hub stopped as interrupted says Interrupted, not Time is up", () => {
  it("carries the hub's interrupted flag from the nearest reading", () => {
    const found = nearestOf({ items: [{ task_id: "a", interrupted: true, started_at: "2026-11-12T08:00:00Z", in_force: { runtime_seconds: 900 } }] });
    expect(found.a.interrupted).toBe(true);
  });

  it("has a chip that reads Interrupted", () => {
    expect(interruptedTint.chip).toBe("Interrupted");
  });
});

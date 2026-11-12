import type { CSSProperties } from "react";
import type { CapNearest, CapsReading } from "./api";
import { linesOf, type CapKey } from "./capsFigures";

export type CapTint = { tint: number; chip: string; danger: boolean };

const names: Record<CapKey, string> = { input: "Input", output: "Output", runtimeSeconds: "Runtime" };

const firstShown = 0.5;

const redText = 0.8;

const spentOf = (reading: CapsReading, key: CapKey) => {
  const used = reading.used!;
  return key === "input" ? used.input : key === "output" ? used.output : used.seconds;
};

const tintAt = (key: CapKey, ratio: number, percent: number): CapTint | null => {
  if (ratio < firstShown) return null;
  const passed = ratio >= 1;
  return {
    tint: passed ? 1 : Math.round((0.2 + (0.8 * (ratio - firstShown)) / firstShown) * 1000) / 1000,
    chip: passed ? `${names[key]} passed` : `${names[key]} ${percent}%`,
    danger: ratio >= redText,
  };
};

export const tintOf = (reading: CapsReading): CapTint | null => {
  if (reading.used === null) return null;
  const nearest = linesOf(reading).find((line) => line.nearest);
  if (!nearest) return null;
  return tintAt(nearest.key, spentOf(reading, nearest.key) / reading.inForce[nearest.key], nearest.percent);
};

const timeLeftWords = (seconds: number) => (seconds >= 60 ? `${Math.ceil(seconds / 60)} min left` : `${seconds} s left`);

export const tintOfElapsed = (elapsed: number, cap: number): CapTint => {
  const ratio = elapsed / cap;
  const shaded = tintAt("runtimeSeconds", ratio, Math.min(Math.round(ratio * 100), 99));
  return { tint: shaded?.tint ?? 0, chip: ratio >= 1 ? "Time is up" : timeLeftWords(cap - elapsed), danger: ratio >= redText };
};

export const tintOfNearest = (nearest: CapNearest): CapTint | null => tintAt(nearest.key, nearest.ratio, Math.min(Math.round(nearest.ratio * 100), 99));

export const strongerTint = (first: CapTint | null, second: CapTint | null): CapTint | null => (first && second ? (second.tint > first.tint ? second : first) : first ?? second);

export const tintStyle = (found: CapTint | null): CSSProperties | undefined => (found ? ({ "--cap-tint": found.tint } as CSSProperties) : undefined);

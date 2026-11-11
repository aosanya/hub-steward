import type { CSSProperties } from "react";
import type { CapsReading } from "./api";
import { linesOf, type CapKey } from "./capsFigures";

export type CapTint = { tint: number; chip: string; danger: boolean };

const names: Record<CapKey, string> = { input: "Input", output: "Output", runtimeSeconds: "Runtime" };

const firstShown = 0.5;

const redText = 0.8;

const spentOf = (reading: CapsReading, key: CapKey) => {
  const used = reading.used!;
  return key === "input" ? used.input : key === "output" ? used.output : used.seconds;
};

export const tintOf = (reading: CapsReading): CapTint | null => {
  if (reading.used === null) return null;
  const nearest = linesOf(reading).find((line) => line.nearest);
  if (!nearest) return null;
  const ratio = spentOf(reading, nearest.key) / reading.inForce[nearest.key];
  if (ratio < firstShown) return null;
  const passed = ratio >= 1;
  return {
    tint: passed ? 1 : Math.round((0.2 + (0.8 * (ratio - firstShown)) / firstShown) * 1000) / 1000,
    chip: passed ? `${names[nearest.key]} passed` : `${names[nearest.key]} ${nearest.percent}%`,
    danger: ratio >= redText,
  };
};

export const tintStyle = (found: CapTint | null): CSSProperties | undefined => (found ? ({ "--cap-tint": found.tint } as CSSProperties) : undefined);

import type { Caps, CapsReading } from "./api";

export type CapKey = "input" | "output" | "runtimeSeconds";

export type CapLine = {
  key: CapKey;
  label: string;
  cap: string;
  used: string | null;
  percent: number | null;
  passed: boolean;
  nearest: boolean;
  paused: boolean;
  own: boolean;
};

const grouped = new Intl.NumberFormat("en-US");

export const tokens = (count: number) => grouped.format(count);

export const minutesOf = (seconds: number) => {
  const whole = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (whole === 0) return `${rest} s`;
  return rest === 0 ? `${whole} min` : `${whole} min ${rest} s`;
};

export const minutesField = (seconds: number) => String(Math.round(seconds / 60));

export const standardLine = (caps: Caps) => [tokens(caps.input), tokens(caps.output), minutesOf(caps.runtimeSeconds)].join(" · ");

const labels: Record<CapKey, string> = { input: "Input tokens", output: "Output tokens", runtimeSeconds: "Runtime" };

const keys: CapKey[] = ["input", "output", "runtimeSeconds"];

const shown = (key: CapKey, amount: number) => (key === "runtimeSeconds" ? minutesOf(amount) : tokens(amount));

export const lineOf = (reading: CapsReading, key: CapKey): CapLine => {
  const cap = reading.inForce[key];
  const spent = reading.used === null ? null : key === "input" ? reading.used.input : key === "output" ? reading.used.output : reading.used.seconds;
  const passed = spent !== null && spent >= cap;
  const rounded = spent === null ? null : Math.round((spent / cap) * 100);
  return {
    key,
    label: labels[key],
    cap: shown(key, cap),
    used: spent === null ? null : `${shown(key, spent)} of ${shown(key, cap)}`,
    percent: rounded === null ? null : passed ? 100 : Math.min(rounded, 99),
    passed,
    nearest: false,
    paused: key === "runtimeSeconds" && reading.used?.clockStopped === true,
    own: reading.own !== null && reading.own[key] > 0,
  };
};

export const linesOf = (reading: CapsReading): CapLine[] => {
  const lines = keys.map((key) => lineOf(reading, key));
  const highest = Math.max(...lines.map((line) => line.percent ?? 0));
  const first = highest > 0 ? lines.findIndex((line) => line.percent === highest) : -1;
  return lines.map((line, at) => ({ ...line, nearest: at === first }));
};

export const ownershipOf = (reading: CapsReading): string => {
  const own = reading.own === null ? 0 : keys.filter((key) => reading.own![key] > 0).length;
  if (own === 0) return "Default for all workers";
  return `${own === keys.length ? "This issue's own numbers" : "Some numbers are this issue's own"} · the default is ${standardLine(reading.standard)}`;
};

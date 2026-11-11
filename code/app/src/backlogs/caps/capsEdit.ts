import type { Caps, CapsChange, CapsReading } from "./api";
import { minutesField } from "./capsFigures";

export type Typed = { input: string; output: string; minutes: string };

export const wholeNumberWords = "A whole number above zero.";

export const typedFrom = (reading: CapsReading): Typed => ({
  input: String(reading.inForce.input),
  output: String(reading.inForce.output),
  minutes: minutesField(reading.inForce.runtimeSeconds),
});

const wholeAboveZero = /^[1-9]\d*$/;

export type Problems = Partial<Record<keyof Typed, string>>;

export const problemsIn = (typed: Typed): Problems =>
  Object.fromEntries(
    (Object.keys(typed) as (keyof Typed)[])
      .filter((key) => typed[key].trim() !== "" && !wholeAboveZero.test(typed[key].trim()))
      .map((key) => [key, wholeNumberWords]),
  );

const numberOf = (text: string) => (text.trim() === "" ? undefined : Number(text.trim()));

export const changeOf = (typed: Typed): CapsChange => {
  const input = numberOf(typed.input);
  const output = numberOf(typed.output);
  const minutes = numberOf(typed.minutes);
  return {
    ...(input === undefined ? {} : { input }),
    ...(output === undefined ? {} : { output }),
    ...(minutes === undefined ? {} : { runtimeSeconds: minutes * 60 }),
  };
};

export const droppedOwn = (own: Caps | null, change: CapsChange) =>
  own !== null && (["input", "output", "runtimeSeconds"] as const).some((key) => own[key] > 0 && change[key] === undefined);

export const sentNothing = (change: CapsChange) => Object.keys(change).length === 0;

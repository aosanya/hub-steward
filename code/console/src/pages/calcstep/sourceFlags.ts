export type ValueKind = "currency" | "number" | "text" | "date" | "yes_no";

export type SourceKind = "step" | "record" | "ledger" | "fixed";

export type Source =
  | { kind: "step"; step: string; question: string; type: ValueKind; questionNow?: string }
  | { kind: "record"; record: string; question: string; type: ValueKind; questionNow?: string }
  | { kind: "ledger" }
  | { kind: "fixed"; value: string };

export type InputRow = { name: string; type: ValueKind; source: Source | null };

export type Flag = "no-source" | "reworded" | "wrong-type";

export type Fits = (input: ValueKind, source: ValueKind) => boolean;

export const sameKind: Fits = (input, source) => input === source;

export const sourceKind = (source: Source | null): SourceKind | null => source?.kind ?? null;

export const sourceType = (source: Source): ValueKind | null => {
  if (source.kind === "ledger") return "currency";
  if (source.kind === "fixed") return null;
  return source.type;
};

const isBlankFixed = (source: Source) => source.kind === "fixed" && source.value.trim() === "";

const isReworded = (source: Source) => (source.kind === "step" || source.kind === "record") && source.questionNow !== undefined && source.questionNow !== source.question;

export function sourceFlag(row: InputRow, fits: Fits = sameKind): Flag | null {
  const { source } = row;
  if (source === null || isBlankFixed(source)) return "no-source";
  if (isReworded(source)) return "reworded";
  const type = sourceType(source);
  if (type !== null && !fits(row.type, type)) return "wrong-type";
  return null;
}

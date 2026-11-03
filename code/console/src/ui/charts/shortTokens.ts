export function shortTokens(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
}

export const tokenCount = (value: number) => value.toLocaleString("en-US");

export const percentOf = (part: number, whole: number) => (whole > 0 ? Math.round((part * 100) / whole) : 0);

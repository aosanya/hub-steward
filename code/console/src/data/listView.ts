const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

export const byName = <T>(rows: T[], nameOf: (row: T) => string): T[] => [...rows].sort((a, b) => collator.compare(nameOf(a), nameOf(b)));

export const matching = <T>(rows: T[], textsOf: (row: T) => string[], search: string): T[] => {
  const needle = search.trim().toLowerCase();
  return needle === "" ? rows : rows.filter((row) => textsOf(row).some((text) => text.toLowerCase().includes(needle)));
};

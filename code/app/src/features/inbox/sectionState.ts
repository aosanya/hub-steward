export type ReadStatus = "loading" | "ready" | "failed";

export type Part = { name: string; status: ReadStatus };

export type SectionState = { loading: boolean; words: string };

const listed = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

export const sectionState = (section: string, parts: Part[], hasRows: boolean): SectionState => {
  const failed = parts.filter((p) => p.status === "failed").map((p) => p.name);
  const loading = failed.length === 0 && !hasRows && parts.some((p) => p.status === "loading");
  if (failed.length === 0) return { loading, words: "" };
  return { loading: false, words: hasRows ? `${section} could not load ${listed(failed)}.` : `${section} could not be loaded.` };
};

export const allAnswered = (parts: Part[]) => parts.every((p) => p.status === "ready");

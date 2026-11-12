import type { IssueNote } from "../issueNotes";

export const startedAtOf = (notes: IssueNote[]): number | null => {
  const moments = notes.filter((note) => note.kind === "worker" && !note.automatic).map((note) => new Date(note.at).getTime()).filter((moment) => Number.isFinite(moment));
  return moments.length === 0 ? null : Math.min(...moments);
};

export const elapsedSeconds = (startedAt: number, now: number) => Math.max(0, Math.floor((now - startedAt) / 1000));

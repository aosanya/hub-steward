import type { IssueNote } from "../shared/issueNotes";

const claimWriteWindowMs = 5000;
const movedPattern = /^Moved (.*?) to (.*)$/;
const doingSteps = ["doing", "in-progress"];

const momentOf = (note: IssueNote) => new Date(note.at).getTime();

const movedIntoDoing = (note: IssueNote) => {
  const destination = note.automatic ? movedPattern.exec(note.text)?.[2] : undefined;
  return destination !== undefined && doingSteps.includes(destination.slice(destination.lastIndexOf("/") + 1));
};

export const startedAtOf = (notes: IssueNote[]): number | null => {
  const claimedAt = Math.max(-Infinity, ...notes.filter(movedIntoDoing).map(momentOf).filter(Number.isFinite));
  const moments = notes
    .filter((note) => note.kind === "worker" && !note.automatic)
    .map(momentOf)
    .filter((moment) => Number.isFinite(moment) && moment >= claimedAt - claimWriteWindowMs);
  return moments.length === 0 ? null : Math.min(...moments);
};

export const elapsedSeconds = (startedAt: number, now: number) => Math.max(0, Math.floor((now - startedAt) / 1000));

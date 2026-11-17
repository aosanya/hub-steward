export const approvedWords = "Approved";

export const refusedWords = "Refused";

export const decidedWords = "Decided";

export const reasonWords = "Reason";

const decisionWords: Record<string, string> = { approved: approvedWords, refused: refusedWords };

export const decisionStatus = (decision: string): string => decisionWords[decision] ?? "";

export const sentWords = "Sent";

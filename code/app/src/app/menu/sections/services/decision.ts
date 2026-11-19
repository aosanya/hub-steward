import { endDayWords } from "../../../../shared/ui/days";
import { text, type Item } from "../staff/staffData";

export const approvedWords = "Approved";

export const refusedWords = "Refused";

export const decidedWords = "Decided";

export const reasonWords = "Reason";

export const certificateWords = "Certificate";

export const validUntilWords = "Valid until";

const decisionWords: Record<string, string> = { approved: approvedWords, refused: refusedWords };

export const decisionStatus = (decision: string): string => decisionWords[decision] ?? "";

export const sentWords = "Sent";

export const certificateFields = { [certificateWords]: "certificate_ref", [validUntilWords]: "valid_until_line" };

export const certificateOf = (sent: Item) => ({ certificate_ref: text(sent, "certificate_ref"), valid_until_line: endDayWords(text(sent, "valid_until")) });

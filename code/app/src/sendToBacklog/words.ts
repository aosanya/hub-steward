import { issuesWords } from "../backlogs/tags";
import type { SendResult, Target } from "./types";

export const sendWords = "Send to backlog";

export const selectWords = "Select";

export const cancelWords = "Cancel";

export const allWords = "All";

export const noTargetsWords = "No backlog to send to";

export const selectedWords = (count: number) => `${count} selected`;

export const sheetTitleWords = (count: number) => `Send ${issuesWords(count)} to`;

export const landsAtWords = (target: Target) => `lands at ${target.stepName}`;

export const outcomeWords = (result: SendResult, total: number, target: Target) =>
  result.refusal === ""
    ? `${issuesWords(result.sent)} sent to ${target.name}`
    : `${result.sent} of ${total} sent to ${target.name}. ${result.refusal}`;

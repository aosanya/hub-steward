import { capitalised } from "./capitalised";

export const efforts = ["very_low", "low", "medium", "high", "very_high", "unknown"];

export const effortWords = (effort: string) => capitalised(effort.replace("_", " "));

export const effortKnown = (effort?: string) => effort !== undefined && effort !== "" && effort !== "unknown";

export const effortLabel = (effort?: string) => `Effort: ${effortWords(effort || "unknown")}`;

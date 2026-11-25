import { McpError } from "../../../shared/wakala/mcp";
import type { Answer } from "./types";

const forbiddenText = /\b403\b|\bforbidden\b/i;

const missingText = /not found|\b404\b|unknown backlog/i;

export const failureOf = (error: unknown): Answer<never> => {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof McpError && error.unauthorized) return { state: "forbidden" };
  if (forbiddenText.test(message)) return { state: "forbidden" };
  if (missingText.test(message)) return { state: "missing" };
  return { state: "failed" };
};

export const settle = async <T>(read: () => Promise<T>): Promise<Answer<T>> => {
  try {
    return { state: "ready", data: await read() };
  } catch (error) {
    return failureOf(error);
  }
};

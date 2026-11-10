import { McpError } from "../wakala/mcp";

const longest = 120;

const notAllowedWords = "You do not have access to this yet.";

const prefix = /^(?:[a-z][a-z0-9]*_[a-z0-9_]*|agencies|ai|wakala answered \d+):\s*/;

const secretShaped = /https?:\/\/\S+|Bearer\s+\S+|\b(?:sk|pk|key|tok|token)[-_][A-Za-z0-9_-]{8,}|\b[A-Za-z0-9_-]{24,}\b/g;

const withoutPrefixes = (text: string) => {
  let rest = text.trim();
  for (let step = 0; step < 4; step += 1) {
    const next = rest.replace(prefix, "");
    if (next === rest) break;
    rest = next;
  }
  return rest;
};

const oneLine = (text: string) => {
  const line = text.split("\n")[0].replace(secretShaped, "").replace(/\s+/g, " ").trim();
  if (/^[^a-zA-Z]*$/.test(line)) return "";
  return line.length > longest ? `${line.slice(0, longest).trimEnd()}…` : line;
};

export const failureReason = (failure: unknown): string => {
  if (!(failure instanceof Error)) return "";
  const message = failure.message;
  if ((failure instanceof McpError && failure.unauthorized) || message === "not signed in") return "Your session ended. Sign in again.";
  if (failure instanceof TypeError || /failed to fetch|load failed|networkerror/i.test(message)) return "We could not reach the hub";
  if (message === "slow") return "No answer came in time.";
  if (/answered 429\b/.test(message)) return "Too many requests. Try again in a minute.";
  if (/instance not found/i.test(message)) return notAllowedWords;
  return oneLine(withoutPrefixes(message));
};

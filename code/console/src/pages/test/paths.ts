import { hubPath } from "../../api";

export const testPath = (
  hubId: string,
  params: Record<string, string> = {},
): string => {
  const query = new URLSearchParams(params).toString();
  return hubPath(hubId, "test") + (query === "" ? "" : "?" + query);
};

export const resultKind = (
  result: string,
): "ok" | "bad" | "warn" | "use" | "mute" =>
  result === "passed"
    ? "ok"
    : result === "failed"
      ? "bad"
      : result === "stopped"
        ? "warn"
        : result === "running"
          ? "use"
          : "mute";

export const reportPath = (hubId: string, runId: string): string =>
  testPath(hubId, { run: runId, report: "1" });

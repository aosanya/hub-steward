import { useState } from "react";
import type { TestResult } from "../../data/accounts";

export type TestRun =
  | { phase: "idle" }
  | { phase: "sending" }
  | { phase: "done"; working: boolean; reason: string; prompt: string; reply: string; tookMs: number | null };

const toolPrefix = /^ai_[a-z_]+:\s*/;

export const sentenceOf = (error: unknown, secret = ""): string => {
  const said = error instanceof Error ? error.message.replace(toolPrefix, "").trim() : "";
  return secret === "" ? said : said.split(secret).join("").trim();
};

const idle: TestRun = { phase: "idle" };

export function useTestRun() {
  const [run, setRun] = useState<TestRun>(idle);

  const start = async (call: () => Promise<TestResult>) => {
    setRun({ phase: "sending" });
    try {
      const result = await call();
      setRun({
        phase: "done",
        working: result.working,
        reason: result.reason,
        prompt: result.prompt,
        reply: result.reply,
        tookMs: result.tookMs,
      });
    } catch (error) {
      setRun({ phase: "done", working: false, reason: sentenceOf(error), prompt: "", reply: "", tookMs: null });
    }
  };

  const clear = () => setRun(idle);

  return { run, busy: run.phase === "sending", start, clear };
}

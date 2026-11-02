import { callTool } from "../wakala/mcp";
import { draftScope } from "./draft";
import { isRecord, itemsOf, textOf } from "./pages/groups";
import type { TestRun } from "./testRun";

export type WhyAnswer = {
  number: number;
  step: string;
  actor: string;
  did: string;
  ruleCode: string;
  ruleText: string;
  expected: string;
  found: string;
};

const causeTokens = 160;

const causeSystem =
  "You explain, in one plain sentence of at most thirty words, the most likely cause of a failed step in an automated test of a community's agency. Use only the lines you are given. Do not repeat Expected or Found.";

export const firstFailed = (run: TestRun): number => run.steps.findIndex((step) => step.failed);

export const whyOf = (run: TestRun, index: number, rules: Record<string, unknown>[]): WhyAnswer | null => {
  const step = run.steps[index];
  if (!step || !step.failed) return null;
  const broken = step.rules.find((rule) => !rule.held);
  const code = broken?.code ?? "";
  return {
    number: index + 1,
    step: step.step,
    actor: step.actor,
    did: step.did,
    ruleCode: code,
    ruleText: textOf(
      rules.find((rule) => textOf(rule, "code") === code),
      "text",
    ),
    expected: step.expected,
    found: step.found,
  };
};

export const causeAsked = (answer: WhyAnswer): string =>
  [
    `Step ${answer.number}: ${answer.step}, played by ${answer.actor}`,
    `It did: ${answer.did}`,
    answer.ruleCode ? `Rule ${answer.ruleCode}: ${answer.ruleText}` : "",
    `Expected: ${answer.expected}`,
    `Found: ${answer.found}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

const contentOf = (reply: unknown): string => {
  const message = isRecord(reply) && isRecord(reply.message) ? reply.message : {};
  return typeof message.content === "string" ? message.content.trim() : "";
};

export const likelyCauseOf = async (hubId: string, answer: WhyAnswer): Promise<string> => {
  try {
    const account = await callTool<unknown>(hubId, "ai_get_default_account");
    const accountID = textOf(account, "id");
    if (accountID === "") return "";
    const reply = await callTool<unknown>(hubId, "ai_chat_account", {
      accountID,
      messages: [
        { role: "system", content: causeSystem },
        { role: "user", content: causeAsked(answer) },
      ],
      max_tokens: causeTokens,
    });
    return contentOf(reply);
  } catch {
    return "";
  }
};

export type WhyLoaded = { answer: WhyAnswer; cause: string };

export const loadWhy = async (hubId: string, run: TestRun, index: number): Promise<WhyLoaded | null> => {
  const scope = await draftScope(hubId).catch(() => ({}));
  const rules = await callTool<unknown>(hubId, "agency_list_rules", scope).catch(() => []);
  const answer = whyOf(run, index, itemsOf(rules));
  if (!answer) return null;
  return { answer, cause: await likelyCauseOf(hubId, answer) };
};

import { screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import * as data from "../../data/accounts";
import type { Account, TestResult } from "../../data/accounts";
import type { Hub } from "../../types";
import { owner, renderModelAt } from "../limits/harness";

const base: Account = {
  id: "a1",
  name: "main",
  provider: "openai_compatible",
  baseUrl: "https://api.meta.ai/v1",
  modelName: "muse-spark-1.3",
  status: "enabled",
  keySet: true,
  lastTestResult: "",
  lastTestedAt: "",
  lastTestPrompt: "",
  lastTestReply: "",
  lastTestMs: null,
  chatEnabled: true,
  chatLabel: "",
};

export const metaAccount: Account = base;

export const claudeAccount: Account = {
  ...base,
  id: "a2",
  provider: "anthropic",
  baseUrl: "https://api.anthropic.com",
  modelName: "claude-sonnet-5-5",
  chatEnabled: false,
};

export const glmAccount: Account = {
  ...base,
  id: "a3",
  baseUrl: "https://router.huggingface.co/v1",
  modelName: "zai-org/GLM-5.3:novita",
  chatEnabled: true,
  chatLabel: "GLM-5.3 (Hugging Face)",
};

export const openWeightsAccount: Account = {
  ...base,
  id: "a4",
  baseUrl: "https://muse.example.com/v1",
  modelName: "muse-spark-open",
  chatEnabled: false,
};

export const customAccount: Account = {
  ...base,
  id: "a5",
  baseUrl: "https://llm.example.org/v1",
  modelName: "my-org/llama-4-open",
  chatEnabled: false,
};

const accountFunctions = ["getAccount", "listAccounts", "updateAccount", "setAccountKey", "testAccount"] as const;

export type AccountFunction = (typeof accountFunctions)[number];
type Reply<T> = T | Error | (() => T | Error | Promise<T>);
export type Replies = {
  getAccount?: Reply<Account>;
  listAccounts?: Reply<Account[]>;
  updateAccount?: Reply<Account>;
  setAccountKey?: Reply<Account>;
  testAccount?: Reply<TestResult>;
};
export type Call = { fn: AccountFunction; args: unknown[] };

export function stubAccounts(replies: Replies) {
  const calls: Call[] = [];
  for (const fn of accountFunctions) {
    const stub = data[fn] as unknown as (...args: unknown[]) => Promise<unknown>;
    vi.mocked(stub).mockImplementation(async (...args) => {
      calls.push({ fn, args });
      if (!(fn in replies)) throw new Error("unexpected " + fn);
      const entry = replies[fn] as unknown;
      const reply = typeof entry === "function" ? await entry() : entry;
      if (reply instanceof Error) throw reply;
      return reply;
    });
  }
  return calls;
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export const callsTo = (calls: Call[], fn: AccountFunction) => calls.filter((call) => call.fn === fn);

export function renderEdit(accountId: string, replies: Replies, hub: Hub = owner) {
  const calls = stubAccounts(replies);
  renderModelAt("/h/" + hub.id + "/models/" + accountId + "/key", hub);
  return calls;
}

export const opened = (account: Account, others: Account[] = []) => ({
  getAccount: account,
  listAccounts: [account, ...others],
});

export const pageReady = async () => {
  const heading = await screen.findByRole("heading", { name: "Connect a model" });
  await waitFor(() => expect(screen.queryByText(/Loading models from/)).not.toBeInTheDocument());
  return heading;
};

export const answered = (tookMs: number, reply = "OK"): TestResult => ({
  working: true,
  reason: "",
  tookMs,
  prompt: "Reply with the single word OK.",
  reply,
});

export const refused = (reason: string, tookMs: number | null = 80): TestResult => ({ working: false, reason, tookMs, prompt: "Reply with the single word OK.", reply: "" });

export const testedBefore = (account: Account, fields: Partial<Account> = {}): Account => ({
  ...account,
  lastTestedAt: "2026-10-28T09:00:00Z",
  lastTestResult: "working",
  lastTestPrompt: "Reply with the single word OK.",
  lastTestReply: "OK",
  lastTestMs: 410,
  ...fields,
});

export const noticeShowing = async (text: string) => (await screen.findByText(text)).closest(".notice") as HTMLElement;

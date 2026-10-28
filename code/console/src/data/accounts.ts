import { McpError, callTool } from "../wakala/mcp";
import { heldLimitsOf, itemsOf, text, type Loose } from "./modelLimits";

export type Account = {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  modelName: string;
  status: "enabled" | "disabled";
  keySet: boolean;
  lastTestResult: string;
  lastTestedAt: string;
  chatEnabled: boolean;
  chatLabel: string;
  lastTestPrompt: string;
  lastTestReply: string;
  lastTestMs: number | null;
  isDefault?: boolean;
};

export type NewAccount = {
  name: string;
  provider: string;
  baseUrl: string;
  modelName: string;
  chatEnabled?: boolean;
  chatLabel?: string;
};

export type AccountPatch = Partial<Pick<Account, "name" | "baseUrl" | "modelName" | "status" | "chatEnabled" | "chatLabel">>;

export type AccountUser = { id: string; name: string; description: string };

export type TestResult = { working: boolean; reason: string; tookMs: number | null; prompt: string; reply: string };

const maxChatLabelLength = 60;
const needsModelWords = "choose a model";
const needsKeyWords = "enter the key";
const notAccountWords = "the answer was not a model";
const labelTooLongWords = `the chat label can be at most ${maxChatLabelLength} characters`;
const noTestAnswerWords = "the test gave no answer";
const failedWords = "the request failed";
const hiddenWords = "(hidden)";
const workingWords = "working";

const isObject = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value);

const millisecondsOf = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

const accountOf = (raw: Loose): Account => ({
  id: text(raw.id),
  name: text(raw.name),
  provider: text(raw.provider),
  baseUrl: text(raw.base_url),
  modelName: text(raw.model_name),
  status: raw.status === "enabled" ? "enabled" : "disabled",
  keySet: raw.key_set === true,
  lastTestResult: text(raw.last_test_result),
  lastTestedAt: text(raw.last_tested_at),
  chatEnabled: raw.chat_enabled === true,
  chatLabel: text(raw.chat_label),
  lastTestPrompt: text(raw.last_test_prompt),
  lastTestReply: text(raw.last_test_reply),
  lastTestMs: millisecondsOf(raw.last_test_ms),
  isDefault: raw.default === true,
});

const accountFrom = (raw: unknown): Account => {
  if (!isObject(raw) || text(raw.id) === "") throw new Error(notAccountWords);
  return accountOf(raw);
};

const requireId = (id: string) => {
  if (!id) throw new Error(needsModelWords);
};

const checkedLabel = (label: string | undefined): string | undefined => {
  if (label === undefined) return undefined;
  const trimmed = label.trim();
  if (trimmed.length > maxChatLabelLength) throw new Error(labelTooLongWords);
  return trimmed;
};

const withoutSecret = (error: unknown, secret: string): Error => {
  const said = error instanceof Error ? error.message : "";
  const clean = secret ? said.split(secret).join(hiddenWords) : said;
  if (error instanceof McpError) return new McpError(clean, error.unauthorized);
  return new Error(clean || failedWords);
};

const readRaw = async (hubId: string, id: string): Promise<Loose> => {
  const raw = await callTool<unknown>(hubId, "ai_get_account", { accountID: id });
  if (!isObject(raw) || text(raw.id) === "") throw new Error(notAccountWords);
  return raw;
};

export async function listAccounts(hubId: string): Promise<Account[]> {
  const listed = itemsOf(await callTool(hubId, "ai_list_accounts"));
  return listed.filter((item) => text(item.id) !== "").map(accountOf);
}

export async function getAccount(hubId: string, id: string): Promise<Account> {
  requireId(id);
  return accountOf(await readRaw(hubId, id));
}

export async function createAccount(hubId: string, input: NewAccount): Promise<Account> {
  const label = checkedLabel(input.chatLabel);
  const args: Record<string, unknown> = {
    name: input.name.trim(),
    provider: input.provider,
    base_url: input.baseUrl.trim(),
    model_name: input.modelName.trim(),
    status: "enabled",
  };
  if (input.chatEnabled !== undefined) args.chat_enabled = input.chatEnabled;
  if (label !== undefined) args.chat_label = label;
  const created = accountFrom(await callTool<unknown>(hubId, "ai_create_account", args));
  return withDefaultSettled(hubId, created);
}

export async function setDefaultAccount(hubId: string, id: string): Promise<Account> {
  requireId(id);
  return accountFrom(await callTool<unknown>(hubId, "ai_set_default_account", { accountID: id }));
}

export async function ensureDefaultAccount(hubId: string, accounts: Account[]): Promise<Account[]> {
  if (accounts.some((account) => account.isDefault)) return accounts;
  const first = accounts.find((account) => account.status === "enabled" && account.keySet);
  if (!first) return accounts;
  const marked = await setDefaultAccount(hubId, first.id);
  return accounts.map((account) => (account.id === marked.id ? marked : account));
}

const withDefaultSettled = async (hubId: string, created: Account): Promise<Account> => {
  try {
    const settled = await ensureDefaultAccount(hubId, await listAccounts(hubId));
    return settled.find((account) => account.id === created.id) ?? created;
  } catch {
    return created;
  }
};

export async function updateAccount(hubId: string, id: string, patch: AccountPatch): Promise<Account> {
  requireId(id);
  const label = checkedLabel(patch.chatLabel);
  const raw = await readRaw(hubId, id);
  const held = accountOf(raw);
  const next = {
    name: patch.name?.trim() ?? held.name,
    baseUrl: patch.baseUrl?.trim() ?? held.baseUrl,
    modelName: patch.modelName?.trim() ?? held.modelName,
    status: patch.status ?? held.status,
    chatEnabled: patch.chatEnabled ?? held.chatEnabled,
    chatLabel: label ?? held.chatLabel,
  };
  const args = {
    accountID: id,
    name: next.name,
    provider: held.provider,
    base_url: next.baseUrl,
    model_name: next.modelName,
    status: next.status,
    chat_enabled: next.chatEnabled,
    chat_label: next.chatLabel,
    ...heldLimitsOf(raw),
  };
  return accountFrom(await callTool<unknown>(hubId, "ai_update_account", args));
}

export async function setAccountKey(hubId: string, id: string, key: string): Promise<Account> {
  requireId(id);
  const sent = key.trim();
  if (sent === "") throw new Error(needsKeyWords);
  let keyed: Account;
  try {
    keyed = accountFrom(await callTool<unknown>(hubId, "ai_set_account_key", { accountID: id, key: sent }));
  } catch (error) {
    throw withoutSecret(error, sent);
  }
  return withDefaultSettled(hubId, keyed);
}

export async function testAccount(hubId: string, id: string, typedKey = ""): Promise<TestResult> {
  requireId(id);
  const sent = typedKey.trim();
  const started = Date.now();
  const reply = await callTool<unknown>(hubId, "ai_test_account", sent === "" ? { accountID: id } : { accountID: id, key: sent }).catch((error) => {
    throw sent === "" ? error : withoutSecret(error, sent);
  });
  const measuredMs = Date.now() - started;
  const tested = isObject(reply) ? accountOf(reply) : null;
  const result = tested?.lastTestResult.trim() ?? "";
  const working = result === workingWords;
  return {
    working,
    reason: working ? "" : result || noTestAnswerWords,
    tookMs: tested?.lastTestMs ?? measuredMs,
    prompt: tested?.lastTestPrompt ?? "",
    reply: tested?.lastTestReply ?? "",
  };
}

export async function deleteAccount(hubId: string, id: string): Promise<void> {
  requireId(id);
  await callTool(hubId, "ai_delete_account", { accountID: id });
}

export async function accountUsers(hubId: string, accountId: string): Promise<AccountUser[]> {
  requireId(accountId);
  const [accounts, roles] = await Promise.all([listAccounts(hubId), callTool<unknown>(hubId, "ai_list_roles")]);
  const defaultId = accounts.find((account) => account.isDefault)?.id ?? "";
  const usesAccount = (held: string) => held === accountId || (held === "" && accountId === defaultId);
  return itemsOf(roles)
    .filter((role) => text(role.id) !== "" && usesAccount(text(role.account_id)))
    .map((role) => ({ id: text(role.id), name: text(role.name), description: text(role.description) }));
}

export const chatAccounts = (accounts: Account[]): Account[] =>
  accounts.filter((account) => account.status === "enabled" && account.chatEnabled);

export const chatLabelOf = (account: Account): string => account.chatLabel.trim() || account.modelName;

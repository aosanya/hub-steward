import { afterEach, describe, expect, it, vi } from "vitest";
import { McpError, callTool } from "../wakala/mcp";
import {
  accountUsers,
  chatAccounts,
  chatLabelOf,
  createAccount,
  deleteAccount,
  ensureDefaultAccount,
  getAccount,
  listAccounts,
  setAccountKey,
  setDefaultAccount,
  testAccount,
  updateAccount,
  type Account,
} from "./accounts";

vi.mock("../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../wakala/mcp")>()),
  callTool: vi.fn(),
}));

type Args = Record<string, unknown>;

let calls: { hubId: string; tool: string; args: Args }[] = [];

const answerWith = (replies: Record<string, unknown>) => {
  calls = [];
  vi.mocked(callTool).mockImplementation(async (hubId, tool, args = {}) => {
    calls.push({ hubId, tool, args });
    if (!(tool in replies)) throw new Error("unexpected " + tool);
    const answer = replies[tool];
    if (answer instanceof Error) throw answer;
    return answer as never;
  });
};

const callsTo = (tool: string) => calls.filter((call) => call.tool === tool);

const limitsHeld = {
  tokens_per_call: 8000,
  tokens_per_day: 200000,
  tokens_per_week: null,
  tokens_per_month: 4000000,
  requests_per_day: 1500,
  requests_per_minute: 30,
  requests_per_week: null,
  tokens_per_test: 40000,
  scenarios_at_once: 3,
};

const glm = {
  id: "c1",
  agency_id: "h",
  name: "Hugging Face GLM",
  provider: "openai_compatible",
  base_url: "https://router.huggingface.co/v1",
  model_name: "zai-org/GLM-5.3:novita",
  status: "enabled",
  key_set: true,
  last_test_result: "working",
  last_tested_at: "2026-10-28T09:00:00Z",
  chat_enabled: true,
  chat_label: "  GLM  ",
  last_test_prompt: "Reply with the single word OK.",
  last_test_reply: "OK",
  last_test_ms: 640,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-02T00:00:00Z",
  ...limitsHeld,
};

const claude = {
  ...glm,
  id: "c2",
  name: "Anthropic",
  provider: "anthropic",
  base_url: "https://api.anthropic.com",
  model_name: "claude-sonnet-5-5",
  key_set: false,
  last_test_result: "",
  last_tested_at: "",
  chat_enabled: false,
  chat_label: "",
  last_test_prompt: "",
  last_test_reply: "",
  last_test_ms: 0,
};

const accountOfGlm: Account = {
  id: "c1",
  name: "Hugging Face GLM",
  provider: "openai_compatible",
  baseUrl: "https://router.huggingface.co/v1",
  modelName: "zai-org/GLM-5.3:novita",
  status: "enabled",
  keySet: true,
  lastTestResult: "working",
  lastTestedAt: "2026-10-28T09:00:00Z",
  chatEnabled: true,
  chatLabel: "  GLM  ",
  lastTestPrompt: "Reply with the single word OK.",
  lastTestReply: "OK",
  lastTestMs: 640,
  isDefault: false,
};

const anAccount = (over: Partial<Account>): Account => ({ ...accountOfGlm, ...over });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reading the models of a hub", () => {
  it("lists every account in the backend order with its fields in camelCase", async () => {
    answerWith({ ai_list_accounts: { items: [glm, claude] } });
    const accounts = await listAccounts("h");
    expect(accounts).toEqual([
      accountOfGlm,
      {
        id: "c2",
        name: "Anthropic",
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com",
        modelName: "claude-sonnet-5-5",
        status: "enabled",
        keySet: false,
        lastTestResult: "",
        lastTestedAt: "",
        chatEnabled: false,
        chatLabel: "",
        lastTestPrompt: "",
        lastTestReply: "",
        lastTestMs: null,
        isDefault: false,
      },
    ]);
    expect(calls).toEqual([{ hubId: "h", tool: "ai_list_accounts", args: {} }]);
  });

  it("reads the account the hub marked as its default", async () => {
    answerWith({ ai_list_accounts: { items: [glm, { ...claude, default: true }] } });
    const accounts = await listAccounts("h");
    expect(accounts.map((account) => account.isDefault)).toEqual([false, true]);
  });

  it("reads a default that is not exactly true as not the default", async () => {
    answerWith({ ai_list_accounts: { items: [{ ...glm, default: "true" }, { ...claude, default: 1 }, { ...glm, id: "c3", default: null }] } });
    const accounts = await listAccounts("h");
    expect(accounts.map((account) => account.isDefault)).toEqual([false, false, false]);
  });

  it("reads a hub with no accounts, whether the list is empty or null", async () => {
    answerWith({ ai_list_accounts: { items: null } });
    expect(await listAccounts("h")).toEqual([]);
    answerWith({ ai_list_accounts: [] });
    expect(await listAccounts("h")).toEqual([]);
  });

  it("skips a row without an id", async () => {
    answerWith({ ai_list_accounts: { items: [{ name: "stray" }, glm] } });
    expect(await listAccounts("h")).toHaveLength(1);
  });

  it("treats an account without the chat fields as one that is not in the chat", async () => {
    const { chat_enabled, chat_label, ...older } = glm;
    answerWith({ ai_list_accounts: { items: [older] } });
    const [account] = await listAccounts("h");
    expect(account.chatEnabled).toBe(false);
    expect(account.chatLabel).toBe("");
  });

  it("reads the last test's prompt, reply and milliseconds", async () => {
    answerWith({ ai_get_account: glm });
    const account = await getAccount("h", "c1");
    expect(account.lastTestPrompt).toBe("Reply with the single word OK.");
    expect(account.lastTestReply).toBe("OK");
    expect(account.lastTestMs).toBe(640);
  });

  it("reads missing, zero, negative or non-numeric test fields as empty text and null", async () => {
    const { last_test_prompt, last_test_reply, last_test_ms, ...older } = glm;
    answerWith({
      ai_list_accounts: {
        items: [
          older,
          { ...glm, last_test_prompt: null, last_test_reply: 7, last_test_ms: 0 },
          { ...glm, last_test_ms: -5 },
          { ...glm, last_test_ms: "640" },
        ],
      },
    });
    const accounts = await listAccounts("h");
    expect(accounts[0]).toMatchObject({ lastTestPrompt: "", lastTestReply: "", lastTestMs: null });
    expect(accounts[1]).toMatchObject({ lastTestPrompt: "", lastTestReply: "", lastTestMs: null });
    expect(accounts[2].lastTestMs).toBeNull();
    expect(accounts[3].lastTestMs).toBeNull();
  });

  it("reads a status it does not know as disabled", async () => {
    answerWith({ ai_list_accounts: { items: [{ ...glm, status: "paused" }, { ...claude, status: undefined }] } });
    const accounts = await listAccounts("h");
    expect(accounts.map((account) => account.status)).toEqual(["disabled", "disabled"]);
  });

  it("gets one account by its id", async () => {
    answerWith({ ai_get_account: glm });
    expect(await getAccount("h", "c1")).toEqual(accountOfGlm);
    expect(calls).toEqual([{ hubId: "h", tool: "ai_get_account", args: { accountID: "c1" } }]);
  });

  it("refuses an answer that is not an account", async () => {
    answerWith({ ai_get_account: {} });
    await expect(getAccount("h", "c1")).rejects.toThrow("the answer was not a model");
  });

  it("asks which model when no id is given", async () => {
    answerWith({});
    await expect(getAccount("h", "")).rejects.toThrow("choose a model");
    expect(calls).toEqual([]);
  });

  it("never carries a key out of an account, because the backend never sends one", async () => {
    answerWith({ ai_list_accounts: { items: [{ ...glm, key: "sk-leak", sealed: "x" }] } });
    const [account] = await listAccounts("h");
    expect(JSON.stringify(account)).not.toContain("sk-leak");
    expect(Object.keys(account)).not.toContain("key");
  });
});

describe("adding a model", () => {
  it("sends the provider kind in the backend's words, the address, the model and an enabled status", async () => {
    answerWith({ ai_create_account: claude, ai_list_accounts: { items: [{ ...claude, default: true }] } });
    const created = await createAccount("h", {
      name: "Anthropic",
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      modelName: "claude-sonnet-5-5",
    });
    expect(created.id).toBe("c2");
    expect(created.baseUrl).toBe("https://api.anthropic.com");
    expect(callsTo("ai_create_account")).toEqual([
      {
        hubId: "h",
        tool: "ai_create_account",
        args: {
          name: "Anthropic",
          provider: "anthropic",
          base_url: "https://api.anthropic.com",
          model_name: "claude-sonnet-5-5",
          status: "enabled",
        },
      },
    ]);
  });

  it("sends the chat switch and the trimmed label when they are given", async () => {
    answerWith({ ai_create_account: glm, ai_list_accounts: { items: [glm] }, ai_set_default_account: { ...glm, default: true } });
    await createAccount("h", {
      name: "Hugging Face GLM",
      provider: "openai_compatible",
      baseUrl: "https://router.huggingface.co/v1",
      modelName: "zai-org/GLM-5.3:novita",
      chatEnabled: true,
      chatLabel: "  GLM  ",
    });
    expect(calls[0].args).toMatchObject({ chat_enabled: true, chat_label: "GLM" });
  });

  it("sends chat_enabled false when the switch is explicitly off", async () => {
    answerWith({ ai_create_account: glm, ai_list_accounts: { items: [glm] }, ai_set_default_account: { ...glm, default: true } });
    await createAccount("h", { name: "n", provider: "gemini", baseUrl: "u", modelName: "m", chatEnabled: false });
    expect(calls[0].args.chat_enabled).toBe(false);
    expect("chat_label" in calls[0].args).toBe(false);
  });

  it("trims the pasted name, address and model", async () => {
    answerWith({ ai_create_account: glm });
    await createAccount("h", { name: " n ", provider: "gemini", baseUrl: " https://u ", modelName: " m " });
    expect(calls[0].args).toMatchObject({ name: "n", base_url: "https://u", model_name: "m" });
  });

  it("refuses a chat label of more than sixty characters before calling", async () => {
    answerWith({});
    await expect(
      createAccount("h", { name: "n", provider: "gemini", baseUrl: "u", modelName: "m", chatLabel: "x".repeat(61) }),
    ).rejects.toThrow("the chat label can be at most 60 characters");
    expect(calls).toEqual([]);
  });

  it("accepts a chat label of exactly sixty characters", async () => {
    answerWith({ ai_create_account: glm });
    await createAccount("h", { name: "n", provider: "gemini", baseUrl: "u", modelName: "m", chatLabel: "x".repeat(60) });
    expect(calls[0].args.chat_label).toBe("x".repeat(60));
  });

  it("surfaces the backend's refusal as it was said", async () => {
    answerWith({ ai_create_account: new McpError("ai_create_account: an account with this name already exists") });
    await expect(
      createAccount("h", { name: "n", provider: "gemini", baseUrl: "u", modelName: "m" }),
    ).rejects.toThrow("an account with this name already exists");
  });

  it("surfaces a provider kind the backend has no adapter for", async () => {
    answerWith({ ai_create_account: new McpError('ai_create_account: no adapter exists for this provider kind: "cohere"') });
    await expect(
      createAccount("h", { name: "n", provider: "cohere", baseUrl: "u", modelName: "m" }),
    ).rejects.toThrow("no adapter exists for this provider kind");
    expect(calls[0].args.provider).toBe("cohere");
  });
});

describe("the hub's default model", () => {
  const marked = { ...glm, default: true };

  it("marks the model by its id with ai_set_default_account and returns it as the default", async () => {
    answerWith({ ai_set_default_account: marked });
    const result = await setDefaultAccount("h", "c1");
    expect(result.isDefault).toBe(true);
    expect(calls).toEqual([{ hubId: "h", tool: "ai_set_default_account", args: { accountID: "c1" } }]);
  });

  it("asks which model when no id is given", async () => {
    answerWith({});
    await expect(setDefaultAccount("h", "")).rejects.toThrow("choose a model");
    expect(calls).toEqual([]);
  });

  it("surfaces a refused mark", async () => {
    answerWith({ ai_set_default_account: new McpError("ai_set_default_account: account not found") });
    await expect(setDefaultAccount("h", "gone")).rejects.toThrow("account not found");
  });

  it("marks the first enabled model when the hub has none marked, and returns the list with that one as the default", async () => {
    answerWith({ ai_set_default_account: { ...claude, default: true } });
    const held = [anAccount({ id: "c1", status: "disabled" }), anAccount({ id: "c2" }), anAccount({ id: "c3" })];
    const settled = await ensureDefaultAccount("h", held);
    expect(callsTo("ai_set_default_account")).toEqual([{ hubId: "h", tool: "ai_set_default_account", args: { accountID: "c2" } }]);
    expect(settled.map((account) => account.isDefault)).toEqual([false, true, false]);
  });

  it("leaves the hub's list alone when one model is already marked", async () => {
    answerWith({});
    const held = [anAccount({ id: "c1" }), anAccount({ id: "c2", isDefault: true })];
    expect(await ensureDefaultAccount("h", held)).toBe(held);
    expect(calls).toEqual([]);
  });

  it("marks nothing for a hub with no model, or none enabled", async () => {
    answerWith({});
    expect(await ensureDefaultAccount("h", [])).toEqual([]);
    const disabled = [anAccount({ id: "c1", status: "disabled" })];
    expect(await ensureDefaultAccount("h", disabled)).toBe(disabled);
    expect(calls).toEqual([]);
  });

  it("marks the first enabled model that has a key, passing over an enabled one with none", async () => {
    answerWith({ ai_set_default_account: { ...glm, id: "c3", default: true } });
    const held = [anAccount({ id: "c1", keySet: false }), anAccount({ id: "c2", status: "disabled" }), anAccount({ id: "c3" }), anAccount({ id: "c4" })];
    const settled = await ensureDefaultAccount("h", held);
    expect(callsTo("ai_set_default_account")).toEqual([{ hubId: "h", tool: "ai_set_default_account", args: { accountID: "c3" } }]);
    expect(settled.map((account) => account.isDefault)).toEqual([false, false, true, false]);
  });

  it("marks nothing while no enabled model has a key", async () => {
    answerWith({});
    const held = [anAccount({ id: "c1", keySet: false }), anAccount({ id: "c2", keySet: false }), anAccount({ id: "c3", status: "disabled" })];
    expect(await ensureDefaultAccount("h", held)).toBe(held);
    expect(calls).toEqual([]);
  });

  it("fails with the backend's sentence when it refuses the mark, and does not return the list as if it were settled", async () => {
    answerWith({ ai_set_default_account: new McpError("ai_set_default_account: not allowed", true) });
    await expect(ensureDefaultAccount("h", [anAccount({ id: "c1" })])).rejects.toThrow("not allowed");
  });

  it("does not make a model added without its key the default, since a new account never holds one", async () => {
    answerWith({ ai_create_account: claude, ai_list_accounts: { items: [claude] } });
    const created = await createAccount("h", { name: "Anthropic", provider: "anthropic", baseUrl: "https://api.anthropic.com", modelName: "claude-sonnet-5-5" });
    expect(created.isDefault).toBe(false);
    expect(calls.map((call) => call.tool)).toEqual(["ai_create_account", "ai_list_accounts"]);
  });

  it("makes the first model a hub adds its default when the hub's list shows its key set", async () => {
    const keyed = { ...claude, key_set: true };
    answerWith({ ai_create_account: claude, ai_list_accounts: { items: [keyed] }, ai_set_default_account: { ...keyed, default: true } });
    const created = await createAccount("h", { name: "Anthropic", provider: "anthropic", baseUrl: "https://api.anthropic.com", modelName: "claude-sonnet-5-5" });
    expect(created.isDefault).toBe(true);
    expect(calls.map((call) => call.tool)).toEqual(["ai_create_account", "ai_list_accounts", "ai_set_default_account"]);
    expect(callsTo("ai_set_default_account")[0].args).toEqual({ accountID: "c2" });
  });

  it("still returns the added model when the backend refuses to mark a default", async () => {
    const keyed = { ...claude, key_set: true };
    answerWith({ ai_create_account: claude, ai_list_accounts: { items: [keyed] }, ai_set_default_account: new McpError("ai_set_default_account: not allowed", true) });
    const created = await createAccount("h", { name: "Anthropic", provider: "anthropic", baseUrl: "https://api.anthropic.com", modelName: "claude-sonnet-5-5" });
    expect(created.id).toBe("c2");
    expect(created.isDefault).toBe(false);
  });

  it("does not move the default when a further model is added", async () => {
    answerWith({ ai_create_account: claude, ai_list_accounts: { items: [marked, claude] } });
    const created = await createAccount("h", { name: "Anthropic", provider: "anthropic", baseUrl: "https://api.anthropic.com", modelName: "claude-sonnet-5-5" });
    expect(created.isDefault).toBe(false);
    expect(callsTo("ai_set_default_account")).toEqual([]);
  });

  it("marks the oldest enabled model of a hub that never had a default, not the one just added", async () => {
    answerWith({ ai_create_account: claude, ai_list_accounts: { items: [glm, claude] }, ai_set_default_account: marked });
    const created = await createAccount("h", { name: "Anthropic", provider: "anthropic", baseUrl: "https://api.anthropic.com", modelName: "claude-sonnet-5-5" });
    expect(created.isDefault).toBe(false);
    expect(callsTo("ai_set_default_account")[0].args).toEqual({ accountID: "c1" });
  });

  it("still returns the added model when the hub's models cannot be read afterwards", async () => {
    answerWith({ ai_create_account: claude, ai_list_accounts: new McpError("ai_list_accounts: down") });
    const created = await createAccount("h", { name: "Anthropic", provider: "anthropic", baseUrl: "https://api.anthropic.com", modelName: "claude-sonnet-5-5" });
    expect(created.id).toBe("c2");
  });

  it("marks nothing when the model was not added", async () => {
    answerWith({ ai_create_account: new McpError("ai_create_account: an account with this name already exists") });
    await expect(createAccount("h", { name: "n", provider: "gemini", baseUrl: "u", modelName: "m" })).rejects.toThrow("already exists");
    expect(calls.map((call) => call.tool)).toEqual(["ai_create_account"]);
  });
});

describe("changing a model", () => {
  it("sends the whole account with the patch laid over it, keeping the provider and all nine limits as they were read", async () => {
    answerWith({ ai_get_account: glm, ai_update_account: { ...glm, name: "Renamed" } });
    const updated = await updateAccount("h", "c1", { name: "Renamed" });
    expect(updated.name).toBe("Renamed");
    expect(callsTo("ai_get_account")).toEqual([{ hubId: "h", tool: "ai_get_account", args: { accountID: "c1" } }]);
    expect(callsTo("ai_update_account")).toEqual([
      {
        hubId: "h",
        tool: "ai_update_account",
        args: {
          accountID: "c1",
          name: "Renamed",
          provider: "openai_compatible",
          base_url: "https://router.huggingface.co/v1",
          model_name: "zai-org/GLM-5.3:novita",
          status: "enabled",
          chat_enabled: true,
          chat_label: "  GLM  ",
          ...limitsHeld,
        },
      },
    ]);
  });

  it("maps every field of the patch to the backend's words", async () => {
    answerWith({ ai_get_account: glm, ai_update_account: glm });
    await updateAccount("h", "c1", {
      name: "Other",
      baseUrl: "https://other.test/v1",
      modelName: "other-model",
      status: "disabled",
      chatEnabled: false,
      chatLabel: " Other ",
    });
    expect(callsTo("ai_update_account")[0].args).toMatchObject({
      name: "Other",
      base_url: "https://other.test/v1",
      model_name: "other-model",
      status: "disabled",
      chat_enabled: false,
      chat_label: "Other",
    });
  });

  it("keeps a held value when the patch leaves it undefined", async () => {
    answerWith({ ai_get_account: glm, ai_update_account: glm });
    await updateAccount("h", "c1", { name: undefined, status: "disabled" });
    expect(callsTo("ai_update_account")[0].args).toMatchObject({ name: "Hugging Face GLM", status: "disabled", chat_enabled: true });
  });

  it("can clear the chat label with an empty string", async () => {
    answerWith({ ai_get_account: glm, ai_update_account: glm });
    await updateAccount("h", "c1", { chatLabel: "" });
    expect(callsTo("ai_update_account")[0].args.chat_label).toBe("");
  });

  it("keeps null limits null and never sends the key fields", async () => {
    answerWith({ ai_get_account: glm, ai_update_account: glm });
    await updateAccount("h", "c1", { status: "disabled" });
    const sent = callsTo("ai_update_account")[0].args;
    expect(sent.tokens_per_week).toBeNull();
    expect(sent.requests_per_week).toBeNull();
    for (const field of ["id", "agency_id", "key_set", "key", "last_test_result", "created_at", "updated_at"]) {
      expect(field in sent).toBe(false);
    }
  });

  it("keeps the two test limits a save of the account's details does not touch", async () => {
    answerWith({ ai_get_account: glm, ai_update_account: glm });
    await updateAccount("h", "c1", { name: "Renamed" });
    expect(callsTo("ai_update_account")[0].args).toMatchObject({ tokens_per_test: 40000, scenarios_at_once: 3 });
  });

  it("sends a limit the account does not hold as null", async () => {
    answerWith({ ai_get_account: { id: "c1", name: "Bare" }, ai_update_account: glm });
    await updateAccount("h", "c1", { name: "Renamed" });
    const sent = callsTo("ai_update_account")[0].args;
    expect(sent.tokens_per_test).toBeNull();
    expect(sent.scenarios_at_once).toBeNull();
  });

  it("refuses a chat label of more than sixty characters before reading anything", async () => {
    answerWith({});
    await expect(updateAccount("h", "c1", { chatLabel: "x".repeat(61) })).rejects.toThrow("at most 60 characters");
    expect(calls).toEqual([]);
  });

  it("does not update an account that cannot be read", async () => {
    answerWith({ ai_get_account: new McpError("ai_get_account: account not found") });
    await expect(updateAccount("h", "gone", { name: "x" })).rejects.toThrow("account not found");
    expect(callsTo("ai_update_account")).toEqual([]);
  });

  it("asks which model when no id is given", async () => {
    answerWith({});
    await expect(updateAccount("h", "", { name: "x" })).rejects.toThrow("choose a model");
  });
});

describe("the key of a model", () => {
  it("sends the key trimmed and returns the account with no key in it", async () => {
    answerWith({ ai_set_account_key: { ...glm, key_set: true } });
    const account = await setAccountKey("h", "c1", "  sk-secret-123\n");
    expect(account.keySet).toBe(true);
    expect(JSON.stringify(account)).not.toContain("sk-secret-123");
    expect(callsTo("ai_set_account_key")).toEqual([{ hubId: "h", tool: "ai_set_account_key", args: { accountID: "c1", key: "sk-secret-123" } }]);
  });

  it("makes the model the hub's default when its key is the first one set, since a new model holds none", async () => {
    const keyed = { ...claude, key_set: true };
    answerWith({ ai_set_account_key: keyed, ai_list_accounts: { items: [keyed] }, ai_set_default_account: { ...keyed, default: true } });
    const account = await setAccountKey("h", "c2", "sk-secret-123");
    expect(account.isDefault).toBe(true);
    expect(calls.map((call) => call.tool)).toEqual(["ai_set_account_key", "ai_list_accounts", "ai_set_default_account"]);
    expect(callsTo("ai_set_default_account")[0].args).toEqual({ accountID: "c2" });
  });

  it("leaves the default where it is when the hub already has one", async () => {
    const keyed = { ...claude, key_set: true };
    answerWith({ ai_set_account_key: keyed, ai_list_accounts: { items: [{ ...glm, default: true }, keyed] } });
    const account = await setAccountKey("h", "c2", "sk-secret-123");
    expect(account.isDefault).toBe(false);
    expect(callsTo("ai_set_default_account")).toEqual([]);
  });

  it("still returns the model with its key set when the default cannot be settled", async () => {
    const keyed = { ...claude, key_set: true };
    answerWith({ ai_set_account_key: keyed, ai_list_accounts: { items: [keyed] }, ai_set_default_account: new McpError("ai_set_default_account: not allowed", true) });
    const account = await setAccountKey("h", "c2", "sk-secret-123");
    expect(account).toMatchObject({ id: "c2", keySet: true, isDefault: false });
  });

  it("refuses an empty key before calling", async () => {
    answerWith({});
    await expect(setAccountKey("h", "c1", "   ")).rejects.toThrow("enter the key");
    expect(calls).toEqual([]);
  });

  it("keeps the key out of an error the backend echoed", async () => {
    answerWith({ ai_set_account_key: new McpError("ai_set_account_key: invalid key sk-secret-123 for c1") });
    const failure = await setAccountKey("h", "c1", "sk-secret-123").catch((e: Error) => e);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("ai_set_account_key: invalid key (hidden) for c1");
    expect((failure as Error).message).not.toContain("sk-secret-123");
  });

  it("keeps the key out of a failure that is not an McpError and keeps the sign-in flag of one that is", async () => {
    answerWith({ ai_set_account_key: new Error("network down while sending sk-secret-123") });
    const plain = await setAccountKey("h", "c1", "sk-secret-123").catch((e: Error) => e);
    expect((plain as Error).message).not.toContain("sk-secret-123");
    answerWith({ ai_set_account_key: new McpError("not signed in", true) });
    const signedOut = (await setAccountKey("h", "c1", "sk-secret-123").catch((e: McpError) => e)) as McpError;
    expect(signedOut).toBeInstanceOf(McpError);
    expect(signedOut.unauthorized).toBe(true);
    expect(signedOut.message).toBe("not signed in");
  });

  it("gives a plain sentence for an error that carries no text", async () => {
    answerWith({ ai_set_account_key: new Error("") });
    await expect(setAccountKey("h", "c1", "sk-secret-123")).rejects.toThrow("the request failed");
  });

  it("shows no key in the calls the other functions make", async () => {
    answerWith({ ai_get_account: glm, ai_update_account: glm, ai_test_account: glm, ai_delete_account: {} });
    await updateAccount("h", "c1", { name: "x" });
    await testAccount("h", "c1");
    await deleteAccount("h", "c1");
    expect(JSON.stringify(calls)).not.toMatch(/"key"/);
  });
});

describe("testing a model", () => {
  const measuring = (from: number, to: number) => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValueOnce(from).mockReturnValueOnce(to);
  };

  it("reports a working model with no reason, its prompt, its reply and the milliseconds the backend counted", async () => {
    answerWith({ ai_test_account: { ...glm, last_test_result: "working", last_test_ms: 640 } });
    measuring(1000, 1850);
    const result = await testAccount("h", "c1");
    expect(result).toEqual({ working: true, reason: "", tookMs: 640, prompt: "Reply with the single word OK.", reply: "OK" });
    expect(calls).toEqual([{ hubId: "h", tool: "ai_test_account", args: { accountID: "c1" } }]);
  });

  it("falls back to the time measured on the console when the backend counted none", async () => {
    answerWith({ ai_test_account: { ...glm, last_test_result: "working", last_test_ms: 0 } });
    measuring(1000, 1850);
    expect((await testAccount("h", "c1")).tookMs).toBe(850);
  });

  it("falls back to the measured time when the backend sent no milliseconds at all", async () => {
    const { last_test_ms, ...older } = glm;
    answerWith({ ai_test_account: { ...older, last_test_result: "working" } });
    measuring(2000, 2300);
    expect((await testAccount("h", "c1")).tookMs).toBe(300);
  });

  it("reports the backend's sentence when the model did not work", async () => {
    answerWith({ ai_test_account: { ...glm, last_test_result: "the model could not be reached", last_test_reply: "", last_test_ms: 20000 } });
    const result = await testAccount("h", "c1");
    expect(result).toEqual({
      working: false,
      reason: "the model could not be reached",
      tookMs: 20000,
      prompt: "Reply with the single word OK.",
      reply: "",
    });
  });

  it("still carries the prompt and an empty reply when the model refused the key", async () => {
    answerWith({
      ai_test_account: { ...glm, last_test_result: "the model refused the key", last_test_prompt: "Reply with the single word OK.", last_test_reply: "", last_test_ms: 310 },
    });
    expect(await testAccount("h", "c1")).toEqual({
      working: false,
      reason: "the model refused the key",
      tookMs: 310,
      prompt: "Reply with the single word OK.",
      reply: "",
    });
  });

  it.each(["the model forbids this key from making the call", "the model is limiting this key right now"])("carries the model's own sentence %s as the reason", async (sentence) => {
    answerWith({ ai_test_account: { ...glm, last_test_result: sentence, last_test_reply: "", last_test_ms: 120 } });
    const result = await testAccount("h", "c1");
    expect(result.working).toBe(false);
    expect(result.reason).toBe(sentence);
  });

  it("reads a reply that is missing or null as an empty one", async () => {
    const { last_test_reply, ...unanswered } = glm;
    answerWith({ ai_test_account: { ...unanswered, last_test_result: "the model answered with an error" } });
    expect((await testAccount("h", "c1")).reply).toBe("");
    answerWith({ ai_test_account: { ...glm, last_test_result: "the model answered with an error", last_test_reply: null } });
    expect((await testAccount("h", "c1")).reply).toBe("");
  });

  it("reports a model with no key as not working with the backend's sentence", async () => {
    answerWith({ ai_test_account: { ...claude, last_test_result: "no key is set for this account" } });
    expect(await testAccount("h", "c2")).toMatchObject({ working: false, reason: "no key is set for this account", reply: "" });
  });

  it("says the test gave no answer when the result is empty", async () => {
    answerWith({ ai_test_account: { ...glm, last_test_result: "" } });
    expect(await testAccount("h", "c1")).toMatchObject({ working: false, reason: "the test gave no answer" });
  });

  it("returns no key anywhere in the result", async () => {
    answerWith({ ai_set_account_key: glm, ai_test_account: { ...glm, last_test_result: "the model refused the key", last_test_reply: "" } });
    await setAccountKey("h", "c1", "sk-secret-123");
    const result = await testAccount("h", "c1");
    expect(JSON.stringify(result)).not.toContain("sk-secret-123");
    expect(callsTo("ai_test_account")[0].args).toEqual({ accountID: "c1" });
  });

  it("sends a typed key with the test, trimmed, and returns it nowhere", async () => {
    answerWith({ ai_test_account: { ...glm, last_test_result: "working", last_test_ms: 300 } });
    const result = await testAccount("h", "c1", "  sk-typed-123  ");
    expect(callsTo("ai_test_account")[0].args).toEqual({ accountID: "c1", key: "sk-typed-123" });
    expect(JSON.stringify(result)).not.toContain("sk-typed-123");
  });

  it("sends no key at all when none was typed or only blanks were", async () => {
    answerWith({ ai_test_account: { ...glm, last_test_result: "working" } });
    await testAccount("h", "c1", "");
    await testAccount("h", "c1", "   ");
    expect(callsTo("ai_test_account").map((call) => call.args)).toEqual([{ accountID: "c1" }, { accountID: "c1" }]);
  });

  it("keeps the typed key out of a failure's sentence", async () => {
    answerWith({ ai_test_account: new McpError("ai_test_account: the key sk-typed-123 was refused") });
    const failure = await testAccount("h", "c1", "sk-typed-123").catch((error) => error as Error);
    expect(failure).toBeInstanceOf(McpError);
    expect((failure as Error).message).toContain("was refused");
    expect((failure as Error).message).not.toContain("sk-typed-123");
  });

  it("surfaces a failed call", async () => {
    answerWith({ ai_test_account: new McpError("ai_test_account: account not found") });
    await expect(testAccount("h", "gone")).rejects.toThrow("account not found");
  });
});

describe("removing a model", () => {
  it("deletes by id and returns nothing", async () => {
    answerWith({ ai_delete_account: glm });
    expect(await deleteAccount("h", "c1")).toBeUndefined();
    expect(calls).toEqual([{ hubId: "h", tool: "ai_delete_account", args: { accountID: "c1" } }]);
  });

  it("surfaces a failed call", async () => {
    answerWith({ ai_delete_account: new McpError("ai_delete_account: account not found") });
    await expect(deleteAccount("h", "gone")).rejects.toThrow("account not found");
  });

  it("asks which model when no id is given", async () => {
    answerWith({});
    await expect(deleteAccount("h", "")).rejects.toThrow("choose a model");
    expect(calls).toEqual([]);
  });
});

describe("the agents that use a model", () => {
  const roles = [
    { id: "r1", name: "Steward", description: "Welcomes members", account_id: "c1" },
    { id: "r2", name: "Treasurer", description: "Keeps the books", account_id: "c2" },
    { id: "r3", name: "Scribe", description: "Takes minutes", account_id: "" },
    { id: "r4", name: "Stray", description: "", account_id: "gone" },
    { name: "No id", description: "", account_id: "c1" },
  ];

  it("lists the agents whose account is that model", async () => {
    answerWith({ ai_list_accounts: { items: [glm, claude] }, ai_list_roles: { items: roles } });
    expect(await accountUsers("h", "c2")).toEqual([{ id: "r2", name: "Treasurer", description: "Keeps the books" }]);
    expect(callsTo("ai_list_roles")).toEqual([{ hubId: "h", tool: "ai_list_roles", args: {} }]);
  });

  it("gives the model the hub marked as its default the agents that have no model of their own", async () => {
    answerWith({ ai_list_accounts: { items: [{ ...glm, default: true }, claude] }, ai_list_roles: { items: roles } });
    expect((await accountUsers("h", "c1")).map((user) => user.id)).toEqual(["r1", "r3"]);
    expect((await accountUsers("h", "c2")).map((user) => user.id)).toEqual(["r2"]);
  });

  it("follows the mark to a model that is not first, and not to the first enabled one", async () => {
    answerWith({ ai_list_accounts: { items: [glm, { ...claude, default: true }] }, ai_list_roles: { items: roles } });
    expect((await accountUsers("h", "c1")).map((user) => user.id)).toEqual(["r1"]);
    expect((await accountUsers("h", "c2")).map((user) => user.id)).toEqual(["r2", "r3"]);
  });

  it("gives no agent a default when no model is marked", async () => {
    answerWith({ ai_list_accounts: { items: [glm, claude] }, ai_list_roles: { items: roles } });
    expect((await accountUsers("h", "c1")).map((user) => user.id)).toEqual(["r1"]);
    expect((await accountUsers("h", "c2")).map((user) => user.id)).toEqual(["r2"]);
  });

  it("returns an empty list for a model nobody uses, and for a hub with no agents", async () => {
    answerWith({ ai_list_accounts: { items: [glm, claude] }, ai_list_roles: { items: null } });
    expect(await accountUsers("h", "c2")).toEqual([]);
    answerWith({ ai_list_accounts: { items: [glm, claude] }, ai_list_roles: [] });
    expect(await accountUsers("h", "c1")).toEqual([]);
  });

  it("surfaces a failed agents call", async () => {
    answerWith({ ai_list_accounts: { items: [glm] }, ai_list_roles: new McpError("ai_list_roles: not signed in", true) });
    await expect(accountUsers("h", "c1")).rejects.toThrow("not signed in");
  });

  it("asks which model when no id is given", async () => {
    answerWith({});
    await expect(accountUsers("h", "")).rejects.toThrow("choose a model");
  });
});

describe("the models offered in the chat", () => {
  const first = anAccount({ id: "a", modelName: "alpha", chatEnabled: true, chatLabel: "" });
  const hidden = anAccount({ id: "b", modelName: "beta", chatEnabled: false });
  const off = anAccount({ id: "c", modelName: "gamma", chatEnabled: true, status: "disabled" });
  const last = anAccount({ id: "d", modelName: "delta", chatEnabled: true, chatLabel: "Delta" });

  it("keeps the enabled, chat-enabled accounts in list order", () => {
    expect(chatAccounts([first, hidden, off, last]).map((account) => account.id)).toEqual(["a", "d"]);
  });

  it("returns nothing when no account is in the chat", () => {
    expect(chatAccounts([hidden, off])).toEqual([]);
    expect(chatAccounts([])).toEqual([]);
  });

  it("does not change the list it was given", () => {
    const given = [first, hidden];
    chatAccounts(given);
    expect(given).toEqual([first, hidden]);
  });

  it("labels an account by its trimmed chat label", () => {
    expect(chatLabelOf(anAccount({ chatLabel: "  Delta  " }))).toBe("Delta");
  });

  it("labels an account by its model name when the label is empty or blank", () => {
    expect(chatLabelOf(anAccount({ chatLabel: "", modelName: "alpha" }))).toBe("alpha");
    expect(chatLabelOf(anAccount({ chatLabel: "   ", modelName: "alpha" }))).toBe("alpha");
  });
});

import { McpError } from "../wakala/mcp";

export const probeMessage = "Reply with the single word OK.";

export const testSentences = {
  working: "working",
  refused: "the model refused the key",
  unreached: "the model could not be reached",
  error: "the model answered with an error",
  noKey: "no key is set for this account",
} as const;

export const keyedModels = ["muse-spark-1.4", "muse-spark-1.3"];

export const aiTools = [
  "ai_check_limits",
  "ai_create_account",
  "ai_create_role",
  "ai_delete_account",
  "ai_delete_role",
  "ai_get_account",
  "ai_get_default_account",
  "ai_get_role",
  "ai_list_accounts",
  "ai_list_role_revisions",
  "ai_list_roles",
  "ai_list_usage",
  "ai_map_role",
  "ai_record_usage",
  "ai_refresh_models",
  "ai_resolve_agency_role",
  "ai_resolve_role",
  "ai_restore_role_revision",
  "ai_set_account_key",
  "ai_set_default_account",
  "ai_set_limits",
  "ai_test_account",
  "ai_update_account",
  "ai_update_role",
  "ai_usage_breakdown",
] as const;

export type ProviderCall = { provider: string; baseUrl: string; modelName: string; message: string; key: string };

export type ProviderAnswer =
  | { outcome: "answered"; reply: string; tookMs: number }
  | { outcome: "refused" | "unreached" | "error"; tookMs: number };

export type FakeProvider = (call: ProviderCall) => ProviderAnswer | Promise<ProviderAnswer>;

export const providerAnswered = (reply: string, tookMs: number): ProviderAnswer => ({ outcome: "answered", reply, tookMs });

export const providerRefused = (tookMs: number): ProviderAnswer => ({ outcome: "refused", tookMs });

export type AccountJson = {
  id: string;
  agency_id: string;
  name: string;
  provider: string;
  base_url: string;
  model_name: string;
  status: string;
  key_set: boolean;
  last_test_result?: string;
  last_tested_at?: string;
  last_test_prompt: string;
  last_test_reply: string;
  last_test_ms: number;
  chat_enabled: boolean;
  chat_label: string;
  default: boolean;
  tokens_per_call: number | null;
  tokens_per_day: number | null;
  tokens_per_month: number | null;
  requests_per_day: number | null;
  requests_per_minute: number | null;
  tokens_per_week: number | null;
  requests_per_week: number | null;
  tokens_per_test: number | null;
  scenarios_at_once: number | null;
  created_at: string;
  updated_at: string;
};

export type RecordedCall = { hubId: string; tool: string; args: Record<string, unknown> };

export type RecordedAnswer = { tool: string; answer: unknown };

export type RecordedProbe = { provider: string; baseUrl: string; modelName: string; message: string };

export type FakeAiBackendOptions = {
  hubId: string;
  provider: FakeProvider;
  roles?: Record<string, unknown>[];
  usage?: UsageRowJson[];
  latencyMs?: number;
};

export type UsageRowJson = {
  day: string;
  model: string;
  role_id: string;
  role: string;
  kind: string;
  person: string;
  tokens_in: number;
  tokens_out: number;
  requests: number;
};

const usageWindows: Record<string, [string, string]> = {
  today: ["2026-10-28", "2026-10-28"],
  "7d": ["2026-10-22", "2026-10-28"],
  month: ["2026-10-01", "2026-10-28"],
  last_month: ["2026-09-01", "2026-09-30"],
};

const usageGroups = new Set(["person", "agent"]);

type Args = Record<string, unknown>;

const limitKeys = [
  "tokens_per_call",
  "tokens_per_day",
  "tokens_per_month",
  "requests_per_day",
  "requests_per_minute",
  "tokens_per_week",
  "requests_per_week",
  "tokens_per_test",
  "scenarios_at_once",
] as const;

const bodyKeys = new Set<string>([
  "id",
  "agency_id",
  "name",
  "provider",
  "base_url",
  "model_name",
  "status",
  "key_set",
  "last_test_result",
  "last_tested_at",
  "last_test_prompt",
  "last_test_reply",
  "last_test_ms",
  "chat_enabled",
  "chat_label",
  "default",
  "created_at",
  "updated_at",
  ...limitKeys,
]);

const pathKeys = new Set(["accountID", "instance_id"]);
const providerKinds = new Set(["openai_compatible", "anthropic", "gemini"]);
const statuses = new Set(["enabled", "disabled"]);
const requiredFields = ["name", "provider", "base_url", "model_name", "status"] as const;
const maxKeyBytes = 4096;
const maxShownReplyRunes = 120;
const maxChatLabelRunes = 60;

const words = {
  notFound: "account not found",
  invalidAccount: "invalid account",
  duplicate: "an account with this name already exists",
  invalidKey: "invalid key",
  unsupportedKind: "no adapter exists for this provider kind",
  noDefault: "Mark a default AI account under Models before running a test",
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const textOf = (value: unknown): string => (typeof value === "string" ? value : "");

const limitOf = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

const wholeMilliseconds = (ms: number): number => (ms < 0 ? 0 : Math.floor(ms));

const hasControl = (character: string): boolean => /\p{Cc}/u.test(character);

export const shownReply = (raw: string, key: string): string => {
  if (key !== "" && raw.includes(key)) return "";
  const plain = [...raw].filter((character) => !hasControl(character));
  return plain.slice(0, maxShownReplyRunes).join("").trim();
};

const resultOf = (outcome: ProviderAnswer["outcome"]): string => {
  if (outcome === "answered") return testSentences.working;
  if (outcome === "refused") return testSentences.refused;
  if (outcome === "unreached") return testSentences.unreached;
  return testSentences.error;
};

export function createFakeAiBackend({ hubId, provider, roles = [], usage = [], latencyMs = 0 }: FakeAiBackendOptions) {
  const rows: AccountJson[] = [];
  const keys = new Map<string, string>();
  const calls: RecordedCall[] = [];
  const answers: RecordedAnswer[] = [];
  const probes: RecordedProbe[] = [];
  const rejected: { tool: string; reason: string }[] = [];
  let minted = 0;
  let ticks = 0;

  const now = () => new Date(Date.UTC(2026, 9, 28, 9, 0, ticks++)).toISOString();

  const fail = (tool: string, reason: string): never => {
    rejected.push({ tool, reason });
    throw new McpError(`${tool}: ${reason}`);
  };

  const shown = (row: AccountJson): AccountJson => {
    const out = clone(row);
    if (out.last_test_result === "") delete out.last_test_result;
    if (out.last_tested_at === "") delete out.last_tested_at;
    return out;
  };

  const find = (tool: string, accountID: unknown): AccountJson => {
    const row = rows.find((each) => each.id === textOf(accountID));
    return row ?? fail(tool, words.notFound);
  };

  const forgetTest = (row: AccountJson) => {
    row.last_test_result = "";
    row.last_tested_at = "";
    row.last_test_prompt = "";
    row.last_test_reply = "";
    row.last_test_ms = 0;
  };

  const unknownField = (tool: string, args: Args) => {
    const stray = Object.keys(args).find((key) => !bodyKeys.has(key) && !pathKeys.has(key));
    if (stray !== undefined) fail(tool, `json: unknown field "${stray}"`);
  };

  const checked = (tool: string, row: AccountJson) => {
    const empty = requiredFields.find((field) => row[field].trim() === "");
    if (empty !== undefined) fail(tool, `${words.invalidAccount}: ${empty} is required`);
    if (!statuses.has(row.status)) fail(tool, `${words.invalidAccount}: status must be enabled or disabled`);
    if ([...row.chat_label].length > maxChatLabelRunes) fail(tool, `${words.invalidAccount}: chat_label is too long`);
    if (!providerKinds.has(row.provider)) fail(tool, `${words.unsupportedKind}: ${JSON.stringify(row.provider)}`);
    if (limitKeys.some((key) => (row[key] ?? 0) < 0)) fail(tool, `${words.invalidAccount}: a limit cannot be negative`);
  };

  const nameTaken = (name: string, except: string) => rows.some((each) => each.name === name && each.id !== except);

  const limitsFrom = (args: Args) => Object.fromEntries(limitKeys.map((key) => [key, limitOf(args[key])])) as Pick<AccountJson, (typeof limitKeys)[number]>;

  const usageBreakdown = (args: Args) => {
    const window = textOf(args.window);
    const span = usageWindows[window];
    if (!span) fail("ai_usage_breakdown", `window must be today, 7d, month or last_month, got ${JSON.stringify(window)}`);
    const [from, to] = span;
    if (!usageGroups.has(textOf(args.group_by))) fail("ai_usage_breakdown", "group_by must be person or agent");
    const stray = Object.keys(args).find((key) => !["window", "group_by", "role_id", "model", ...pathKeys].includes(key));
    if (stray !== undefined) fail("ai_usage_breakdown", `unknown argument "${stray}"`);
    const roleId = textOf(args.role_id);
    const model = textOf(args.model);
    const kept = usage.filter((row) => row.day >= from && row.day <= to && (roleId === "" || row.role_id === roleId) && (model === "" || row.model === model));
    return { window, from, to, rows: kept };
  };

  const tools: Record<string, (args: Args) => unknown> = {
    ai_usage_breakdown: usageBreakdown,

    ai_list_accounts: () => ({ items: rows.map(shown) }),

    ai_get_account: (args) => shown(find("ai_get_account", args.accountID)),

    ai_refresh_models: (args) => {
      const row = find("ai_refresh_models", args.accountID);
      if (!keys.has(row.id)) fail("ai_refresh_models", testSentences.noKey);
      return { items: keyedModels.map((name) => ({ provider: row.provider, model_name: name, source: "provider" })) };
    },

    ai_create_account: (args) => {
      unknownField("ai_create_account", args);
      const stamp = now();
      const row: AccountJson = {
        id: `acc-${++minted}`,
        agency_id: hubId,
        name: textOf(args.name),
        provider: textOf(args.provider),
        base_url: textOf(args.base_url),
        model_name: textOf(args.model_name),
        status: textOf(args.status),
        key_set: false,
        last_test_prompt: "",
        last_test_reply: "",
        last_test_ms: 0,
        chat_enabled: args.chat_enabled === true,
        chat_label: textOf(args.chat_label),
        default: false,
        ...limitsFrom(args),
        created_at: stamp,
        updated_at: stamp,
      };
      checked("ai_create_account", row);
      if (nameTaken(row.name, "")) fail("ai_create_account", words.duplicate);
      rows.push(row);
      return shown(row);
    },

    ai_update_account: (args) => {
      unknownField("ai_update_account", args);
      const row = find("ai_update_account", args.accountID);
      const next: AccountJson = {
        ...row,
        name: textOf(args.name),
        provider: textOf(args.provider),
        base_url: textOf(args.base_url),
        model_name: textOf(args.model_name),
        status: textOf(args.status),
        ...limitsFrom(args),
        chat_enabled: "chat_enabled" in args ? args.chat_enabled === true : row.chat_enabled,
        chat_label: "chat_label" in args ? textOf(args.chat_label) : row.chat_label,
        updated_at: now(),
      };
      checked("ai_update_account", next);
      if (nameTaken(next.name, row.id)) fail("ai_update_account", words.duplicate);
      Object.assign(row, next);
      return shown(row);
    },

    ai_set_account_key: (args) => {
      const row = find("ai_set_account_key", args.accountID);
      const key = textOf(args.key);
      if (key.trim() === "" || new TextEncoder().encode(key).length > maxKeyBytes) fail("ai_set_account_key", words.invalidKey);
      keys.set(row.id, key);
      row.key_set = true;
      forgetTest(row);
      row.updated_at = now();
      return shown(row);
    },

    ai_set_default_account: (args) => {
      const row = find("ai_set_default_account", args.accountID);
      rows.forEach((each) => {
        each.default = each === row;
      });
      row.updated_at = now();
      return shown(row);
    },

    ai_get_default_account: () => {
      const row = rows.find((each) => each.default);
      return row ? shown(row) : fail("ai_get_default_account", words.noDefault);
    },

    ai_delete_account: (args) => {
      const row = find("ai_delete_account", args.accountID);
      keys.delete(row.id);
      rows.splice(rows.indexOf(row), 1);
      return shown(row);
    },

    ai_list_roles: () => ({ items: clone(roles) }),
  };

  const probe = async (row: AccountJson, key: string) => {
    if (key === "") {
      forgetTest(row);
      row.last_test_result = testSentences.noKey;
      return;
    }
    probes.push({ provider: row.provider, baseUrl: row.base_url, modelName: row.model_name, message: probeMessage });
    const got = await provider({ provider: row.provider, baseUrl: row.base_url, modelName: row.model_name, message: probeMessage, key });
    row.last_test_result = resultOf(got.outcome);
    row.last_test_prompt = probeMessage;
    row.last_test_reply = got.outcome === "answered" ? shownReply(got.reply, key) : "";
    row.last_test_ms = wholeMilliseconds(got.tookMs);
  };

  const testTypedKey = async (row: AccountJson, typed: string) => {
    if (typed.trim() === "" || new TextEncoder().encode(typed).length > maxKeyBytes) fail("ai_test_account", words.invalidKey);
    const trial = clone(row);
    forgetTest(trial);
    await probe(trial, typed);
    trial.last_tested_at = now();
    return shown(trial);
  };

  const testAccount = async (args: Args) => {
    const row = find("ai_test_account", args.accountID);
    const typed = textOf(args.key);
    if (typed !== "") return testTypedKey(row, typed);
    forgetTest(row);
    await probe(row, keys.get(row.id) ?? "");
    row.last_tested_at = now();
    row.updated_at = row.last_tested_at;
    return shown(row);
  };

  const callTool = async <T = unknown>(callerHub: string, tool: string, args: Args = {}): Promise<T> => {
    const sent = clone(args);
    calls.push({ hubId: callerHub, tool, args: sent });
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
    if (callerHub !== hubId) fail(tool, "that agency is not this hub");
    if (!(aiTools as readonly string[]).includes(tool)) fail(tool, `unknown tool ${JSON.stringify(tool)}`);
    const run = tool === "ai_test_account" ? testAccount : tools[tool];
    if (!run) throw new Error(`the fake AI backend does not stand in for ${tool}`);
    const answer = clone(await run(sent));
    answers.push({ tool, answer: clone(answer) });
    return answer as T;
  };

  return {
    callTool,
    calls,
    answers,
    probes,
    rejected,
    callsTo: (tool: string) => calls.filter((call) => call.tool === tool),
    account: (id: string): AccountJson | undefined => {
      const row = rows.find((each) => each.id === id);
      return row ? shown(row) : undefined;
    },
    accounts: (): AccountJson[] => rows.map(shown),
  };
}

export type FakeAiBackend = ReturnType<typeof createFakeAiBackend>;

import { mcpBacklogsClient } from "../backlogs/api";
import { backlogTools, refusalText } from "../backlogManage/api";
import { callTool, McpError } from "../wakala/mcp";
import { DuplicateRules, type FieldChoices, type Match, type Rule, type RuleSet, type SmartBacklog, type SmartBacklogClient } from "./types";

export const smartTools = {
  list: backlogTools.list,
  create: backlogTools.create,
  rename: backlogTools.rename,
  setRules: "taskmanager_backlog_rules_set",
  count: "taskmanager_backlog_rules_count",
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

const ruleOf = (raw: any): Rule => ({ field: raw?.field, operator: raw?.operator, value: text(raw?.value) });

export const setOf = (raw: any): RuleSet => ({
  match: (raw?.match === "any" ? "any" : "all") as Match,
  rules: (Array.isArray(raw?.rules) ? raw.rules : []).map(ruleOf),
});

export const smartOf = (raw: any): SmartBacklog => ({ id: text(raw?.id), name: text(raw?.name), set: setOf(raw?.rules), issues: typeof raw?.issues === "number" ? raw.issues : 0 });

const unique = (values: string[]) => [...new Set(values.filter((value) => value !== ""))].sort();

export const choicesOf = (issues: { topics: string[]; repo: string; priority?: string; step: string; backlog: string }[]): FieldChoices => ({
  tag: unique(issues.flatMap((issue) => [...issue.topics, issue.repo])),
  mark: ["Ready", "Blocked"],
  backlog: unique(issues.map((issue) => issue.backlog)),
  step: unique(issues.map((issue) => issue.step)),
  priority: unique(issues.map((issue) => issue.priority ?? "")),
});

const duplicateOf = (error: unknown): DuplicateRules | null => {
  if (!(error instanceof McpError)) return null;
  const start = error.message.indexOf("{");
  if (start < 0) return null;
  try {
    const detail = JSON.parse(error.message.slice(start));
    return detail?.existing_id ? new DuplicateRules(text(detail.existing_id), text(detail.existing_name)) : null;
  } catch {
    return null;
  }
};

export const mcpSmartBacklogClient: SmartBacklogClient = {
  async choices() {
    return choicesOf(await mcpBacklogsClient.issues());
  },
  async count(set) {
    const reply: any = await callTool("", smartTools.count, { rules: set });
    return typeof reply?.count === "number" ? reply.count : 0;
  },
  async create(name, set) {
    try {
      return text(((await callTool("", smartTools.create, { name, rules: set })) as any)?.id);
    } catch (error) {
      throw duplicateOf(error) ?? new Error(refusalText(error));
    }
  },
  async read(backlogId) {
    const items: any[] = (await callTool("", smartTools.list, {}) as any)?.items ?? [];
    const found = items.find((raw) => text(raw?.id) === backlogId && raw?.kind === "smart");
    if (!found) throw new Error("This smart backlog could not be found.");
    return smartOf(found);
  },
  async update(backlogId, name, set) {
    try {
      await callTool("", smartTools.rename, { backlogID: backlogId, name });
      await callTool("", smartTools.setRules, { backlogID: backlogId, rules: set });
    } catch (error) {
      throw duplicateOf(error) ?? new Error(refusalText(error));
    }
  },
};

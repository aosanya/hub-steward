import { callTool } from "../../../shared/wakala/mcp";
import { allIssuesId, itemsOf } from "../shared/api";
import { settle } from "./answers";
import { fileOf, issueOf, ruleOf } from "./mappers";
import { kindStatuses } from "./statuses";
import { rulebookTools } from "./tools";
import type { ListOptions, OpenedRule, Rule, RuleFile, RuleIssue, RuleKind, RulebookClient } from "./types";

const backlogTool: Record<RuleKind, string> = {
  rule: rulebookTools.backlogRules,
  decision: rulebookTools.backlogDecisions,
  question: rulebookTools.backlogQuestions,
};

const withCode = (rules: Rule[]) => rules.filter((rule) => rule.code !== "");

const decidedIn = (issues: RuleIssue[]) => issues.filter((issue) => issue.relation === "decided_in");

export const mcpRulebookClient = (hubId = ""): RulebookClient => {
  const rules = async (tool: string, args: Record<string, unknown>) => withCode(itemsOf(await callTool(hubId, tool, args)).map(ruleOf));

  const readOne = async (code: string): Promise<Rule> => {
    const reply = await callTool<any>(hubId, rulebookTools.read, { ruleCode: code });
    const rule = ruleOf(reply?.rule ?? reply);
    if (rule.code === "") throw new Error("rule not found");
    return rule;
  };

  const issuesOf = async (code: string): Promise<RuleIssue[]> =>
    itemsOf(await callTool(hubId, rulebookTools.issues, { ruleCode: code })).map(issueOf);

  const filesOf = async (code: string): Promise<RuleFile[]> =>
    itemsOf(await callTool(hubId, rulebookTools.files, { ruleCode: code })).map(fileOf);

  const producedOf = (code: string) => rules(rulebookTools.produced, { ruleCode: code });

  const answerOf = async (code: string): Promise<Rule | undefined> => {
    if (code === "") return undefined;
    try {
      return await readOne(code);
    } catch {
      return undefined;
    }
  };

  const decisionOfIssue = async (issueId: string): Promise<Rule | undefined> => {
    try {
      const reply = await callTool<any>(hubId, rulebookTools.forIssue, { taskID: issueId });
      const linked: any[] = Array.isArray(reply?.linked) ? reply.linked : [];
      const found = linked.find((link) => link?.relation === "decided_in" && link?.rule?.kind === "decision");
      return found ? ruleOf(found.rule) : undefined;
    } catch {
      return undefined;
    }
  };

  const whyFrom = async (issues: RuleIssue[]): Promise<Rule | undefined> => {
    const found = await Promise.all(decidedIn(issues).map((issue) => decisionOfIssue(issue.id)));
    return found.find((rule) => rule !== undefined);
  };

  return {
    list: (backlogId, kind, options: ListOptions = {}) =>
      settle(() => {
        if (!(options.statuses ?? []).every((status) => kindStatuses[kind].includes(status))) throw new Error("status not offered by the kind");
        const statuses = options.statuses?.length ? { status: options.statuses } : {};
        const tags = options.tags?.length ? { tag: options.tags } : {};
        return backlogId === allIssuesId
          ? rules(rulebookTools.list, { kind, ...statuses, ...tags })
          : rules(backlogTool[kind], { backlogID: backlogId, ...statuses });
      }),
    read: (code) => settle(() => readOne(code)),
    issues: (code) => settle(() => issuesOf(code)),
    files: (code) => settle(() => filesOf(code)),
    produced: (code) => settle(() => producedOf(code)),
    settledIn: (code) => settle(async () => decidedIn(await issuesOf(code))),
    why: (code) => settle(async () => whyFrom(await issuesOf(code))),
    open: (code) =>
      settle(async (): Promise<OpenedRule> => {
        const rule = await readOne(code);
        const [issues, files, produced] = await Promise.all([
          issuesOf(code),
          filesOf(code),
          rule.kind === "decision" ? producedOf(code) : Promise.resolve([]),
        ]);
        return {
          rule,
          issues,
          files,
          produced,
          settledIn: rule.kind === "decision" ? decidedIn(issues) : [],
          why: rule.kind === "rule" ? await whyFrom(issues) : undefined,
          answer: rule.kind === "question" ? await answerOf(rule.answeredBy) : undefined,
        };
      }),
  };
};

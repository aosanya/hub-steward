import { listAgencyRoles, type AgencyRole } from "../../../shared/wakala/agencyRoles";
import { callTool } from "../../../shared/wakala/mcp";
import { allIssuesId, itemsOf } from "../shared/api";
import type { Choice, NewQuestion, Question, QuestionOption, QuestionsClient, Standing } from "./types";

export const questionTools = {
  forIssue: "taskmanager_rule_list_for_issue",
  answer: "taskmanager_rule_answer",
  create: "taskmanager_rule_create",
  link: "taskmanager_rule_link",
  myRoles: "agency_get_my_roles",
  read: "taskmanager_rule_read",
  backlog: "taskmanager_backlog_questions_list",
  all: "taskmanager_rule_list",
} as const;

const text = (value: unknown) => (typeof value === "string" ? value : "");

const optionOf = (raw: any): QuestionOption => ({ text: text(raw?.text), recommended: raw?.recommended === true, reason: text(raw?.reason) });

const optionsOf = (value: unknown): QuestionOption[] => {
  const all = (Array.isArray(value) ? value : []).map(optionOf).filter((one) => one.text !== "");
  return [...all.filter((one) => one.recommended), ...all.filter((one) => !one.recommended)];
};

export const questionOf = (raw: any): Question => ({
  id: text(raw?.id),
  code: text(raw?.code),
  title: text(raw?.title),
  body: text(raw?.body),
  priority: text(raw?.priority),
  status: text(raw?.status),
  targetRole: text(raw?.target_role),
  options: optionsOf(raw?.options),
  answer: text(raw?.answer),
  tags: (Array.isArray(raw?.tags) ? raw.tags : []).filter((tag: unknown): tag is string => typeof tag === "string" && tag !== ""),
});

const roleKeys = (raw: unknown): string[] => [text((raw as any)?.id), text((raw as any)?.code)].filter((key) => key !== "");

const standingOf = (reply: any, nameOf: (role: string) => string): Standing => {
  const keys = new Set((Array.isArray(reply?.roles) ? reply.roles : []).flatMap(roleKeys));
  const permissions: unknown[] = Array.isArray(reply?.permissions) ? reply.permissions : [];
  return { holds: (role) => role !== "" && keys.has(role), nameOf, canAsk: permissions.includes("rule.edit") };
};

const namerOf = (roles: AgencyRole[]) => {
  const names = new Map<string, string>();
  roles.filter((role) => role.name !== "").forEach((role) => [role.id, role.code].filter((key) => key !== "").forEach((key) => names.set(key, role.name)));
  return (role: string) => names.get(role) ?? role;
};

const rolesOrNone = async (): Promise<AgencyRole[]> => {
  try {
    return await listAgencyRoles();
  } catch {
    return [];
  }
};

const answerBody = (code: string, choice: Choice) => ({ ruleCode: code, ...choice });

const askWith = async (question: NewQuestion): Promise<string> => {
  const created = await callTool<any>("", questionTools.create, {
    kind: "question",
    title: question.title,
    body: question.body,
    tags: question.tags,
    priority: question.priority,
    target_role: question.targetRole,
    options: question.options,
  });
  const code = text(created?.code);
  await callTool("", questionTools.link, { ruleCode: code, issue_id: question.issueId, relation: "applies_to" });
  return code;
};

export const mcpQuestionsClient: QuestionsClient = {
  forIssue: async (issueId) => {
    const reply = await callTool<any>("", questionTools.forIssue, { taskID: issueId });
    return (Array.isArray(reply?.questions) ? reply.questions : []).map(questionOf).filter((one: Question) => one.code !== "");
  },
  answer: async (code, choice) => {
    await callTool("", questionTools.answer, answerBody(code, choice));
  },
  read: async (code) => {
    const reply = await callTool<any>("", questionTools.read, { ruleCode: code });
    const found = questionOf(reply?.rule ?? reply);
    if (found.code === "") throw new Error("question not found");
    return found;
  },
  list: async (backlogId, statuses) => {
    const status = statuses.length > 0 ? { status: statuses } : {};
    const reply = await callTool("", backlogId === allIssuesId ? questionTools.all : questionTools.backlog, backlogId === allIssuesId ? { kind: "question", ...status } : { backlogID: backlogId, ...status });
    return itemsOf(reply).map(questionOf).filter((one) => one.code !== "");
  },
  standing: async () => {
    const nameOf = namerOf(await rolesOrNone());
    try {
      return standingOf(await callTool<any>("", questionTools.myRoles, {}), nameOf);
    } catch {
      return { holds: () => false, nameOf, canAsk: false };
    }
  },
  roles: listAgencyRoles,
  ask: askWith,
};

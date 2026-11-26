import { callTool } from "../../../shared/wakala/mcp";
import type { Choice, NewQuestion, Question, QuestionOption, QuestionsClient, Standing } from "./types";

export const questionTools = {
  forIssue: "taskmanager_rule_list_for_issue",
  answer: "taskmanager_rule_answer",
  create: "taskmanager_rule_create",
  link: "taskmanager_rule_link",
  myRoles: "agency_get_my_roles",
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

const roleName = (raw: unknown): string => (typeof raw === "string" ? raw : text((raw as any)?.name) || text((raw as any)?.role));

const standingOf = (reply: any): Standing => {
  const names = (Array.isArray(reply?.roles) ? reply.roles : []).map(roleName).map((name: string) => name.toLowerCase());
  const owner = reply?.membership === "owner";
  return { holds: (role) => owner || names.includes(role.trim().toLowerCase()) };
};

const nobody: Standing = { holds: () => false };

const answerBody = (code: string, choice: Choice) => ({ ruleCode: code, ...choice });

const askWith = async (question: NewQuestion): Promise<string> => {
  const created = await callTool<any>("", questionTools.create, {
    kind: "question",
    title: question.title,
    body: question.body,
    tags: question.tags,
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
  standing: async () => {
    try {
      return standingOf(await callTool<any>("", questionTools.myRoles, {}));
    } catch {
      return nobody;
    }
  },
  ask: askWith,
};

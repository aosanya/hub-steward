import { callTool, listTools, type ToolInfo } from "../wakala/mcp";
import { cancelledResult, moveTool, createTool, rulesTool, unconfirmedResult, writeNames, type Confirm } from "./confirm";
import { draftOf, pendingTool, type ResultDraft, type ResultList } from "./results";
import { manyMatchesRule, promptFrom, triagerDescription } from "./triager";

export type Turn = { role: "user" | "assistant"; content: string; lists?: ResultList[] };

export type Answer = { text: string; lists: ResultDraft[] };

export type AssistantClient = {
  model: () => Promise<string>;
  ask: (accountId: string, turns: Turn[], onStep?: (words: string) => void, confirm?: Confirm) => Promise<Answer>;
  reached?: () => Promise<LimitSpan | "">;
};

type Call = { id: string; name: string; arguments: Record<string, unknown> };

type Wire = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_calls?: Call[]; tool_call_id?: string };

export const chatTool = "ai_chat_account";

export const readNames = [
  pendingTool,
  "taskmanager_task_list",
  "taskmanager_task_read",
  "taskmanager_backlog_list",
  "taskmanager_task_state_list",
  "taskmanager_relationship_traverse",
];

export const offeredNames = [...readNames, ...writeNames];

export const maxRounds = 6;

export const maxResultLength = 8000;

export const replyTokens = 4096;

export const stepWords: Record<string, string> = {
  [pendingTool]: "Counting what is pending",
  taskmanager_task_list: "Searching the issues",
  taskmanager_task_read: "Opening an issue",
  taskmanager_backlog_list: "Reading the backlogs",
  taskmanager_task_state_list: "Reading the steps",
  taskmanager_relationship_traverse: "Following what waits on what",
  [moveTool]: "Moving an issue",
  [createTool]: "Creating a backlog",
  [rulesTool]: "Changing the rules",
};

export const noAnswerSentence = "The assistant sent no answer.";

export type LimitSpan = "day" | "month";

export class LimitReached extends Error {
  constructor(readonly span: LimitSpan) {
    super(`assistant limit: ${span}`);
  }
}

const limitSpanIn = (failure: unknown): LimitSpan | null => {
  const found = /assistant limit: (day|month)/.exec(failure instanceof Error ? failure.message : "");
  return found ? (found[1] as LimitSpan) : null;
};

const chat = async (args: Record<string, unknown>) => {
  try {
    return await callTool("", chatTool, args);
  } catch (failure) {
    const span = limitSpanIn(failure);
    throw span ? new LimitReached(span) : failure;
  }
};

export const tooManyRoundsSentence = "I looked things up for several steps and still have no answer. Ask again with a narrower question.";

export const systemPrompt =
  `You are the Triager of this hub's backlogs: the issues loaded from the todo boards, each in one backlog at one step, with tags such as Ready, Blocked and the repo name. Answer the owner's questions by calling the tools you are given, and never name an issue you did not read from a tool. For what is pending, open or left call taskmanager_task_pending first: it returns the total, the counts by step and priority and the top issues in one call. To find other issues use taskmanager_task_list with its filters (tag, repo, backlog, step, untouched_days); a tag filter is case-insensitive and several tags must all match. The issues you read are shown to the owner in a Results tab, so do not list them in your reply: answer briefly in the language the owner writes in, with how many there are and what stands out. If the owner's message is vague, a bare word or phrase such as 'shoe' with no clear intent or filter (it could be a tag, a repo, a title word or a code), call no tool: ask one short question and give the readings as options, each on its own line as [[option]]. For a clear ask call the tool at once. To look up a bare word make one taskmanager_task_pending call with q (words in the title or tags), never several guessed calls. When a result is empty, say so in one sentence. To move an issue, create a backlog or change a smart backlog's rules call the write tool: the owner is shown the change as a card and nothing happens until they tap it, so do not ask them to confirm in words. ${manyMatchesRule}`;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" ? value : "");

const callsOf = (raw: unknown): Call[] =>
  (Array.isArray(raw) ? raw : []).flatMap((entry) => {
    if (!isObject(entry)) return [];
    const name = text(entry.name);
    if (name === "") return [];
    return [{ id: text(entry.id), name, arguments: isObject(entry.arguments) ? entry.arguments : {} }];
  });

const specOf = (tool: ToolInfo) => {
  const schema = tool.inputSchema;
  const properties = Object.fromEntries(Object.entries(isObject(schema.properties) ? schema.properties : {}).filter(([key]) => key !== "instance_id"));
  const required = Array.isArray(schema.required) ? schema.required.filter((key) => key !== "instance_id") : [];
  return { name: tool.name, description: tool.description, parameters: { ...schema, type: "object", properties, required } };
};

const offeredOf = async () => {
  const all = await listTools();
  return offeredNames.flatMap((name) => all.filter((tool) => tool.name === name).map(specOf));
};

const resultText = (result: unknown) => {
  const raw = JSON.stringify(result ?? {});
  return raw.length > maxResultLength ? `${raw.slice(0, maxResultLength)} (cut)` : raw;
};

const refusalOf = async (call: Call, confirm?: Confirm): Promise<string | null> => {
  if (!writeNames.includes(call.name)) return null;
  if (!confirm) return unconfirmedResult;
  return (await confirm({ tool: call.name, arguments: call.arguments })) ? null : cancelledResult;
};

export async function askAssistant(accountId: string, turns: Turn[], onStep: (words: string) => void = () => undefined, confirm?: Confirm): Promise<Answer> {
  const tools = await offeredOf();
  const prompt = promptFrom(await triagerDescription(), systemPrompt);
  const messages: Wire[] = [{ role: "system", content: prompt }, ...turns.map(({ role, content }) => ({ role, content }))];
  const found: ResultDraft[] = [];
  let wrote = false;
  const lists = () => (wrote ? [] : found);
  for (let round = 0; round < maxRounds; round++) {
    const args: Record<string, unknown> = { accountID: accountId, messages: [...messages], max_tokens: replyTokens };
    if (tools.length > 0) args.tools = tools;
    const answer = await chat(args);
    const message = isObject(answer?.message) ? answer.message : {};
    const calls = callsOf(message.tool_calls);
    const content = text(message.content).trim();
    if (calls.length === 0) {
      if (content === "") throw new Error(noAnswerSentence);
      return { text: content, lists: lists() };
    }
    messages.push({ role: "assistant", content, tool_calls: calls });
    for (const call of calls) {
      const allowed = offeredNames.includes(call.name);
      let result = "That tool is not available.";
      const refusal = allowed ? await refusalOf(call, confirm) : null;
      if (allowed && refusal === null) {
        onStep(stepWords[call.name] ?? "Looking it up");
        try {
          const read = await callTool("", call.name, call.arguments);
          const draft = draftOf(call.name, call.arguments, read);
          if (draft) found.push(draft);
          result = resultText(read);
          if (writeNames.includes(call.name)) wrote = true;
        } catch (failure) {
          result = `The call failed: ${failure instanceof Error ? failure.message : "unknown"}`;
        }
      }
      if (refusal !== null) result = refusal;
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  return { text: tooManyRoundsSentence, lists: lists() };
}

export const usageTool = "ai_get_my_assistant_usage";

const reachedOf = (usage: unknown): LimitSpan | "" => {
  const value = isObject(usage) ? usage.reached : "";
  return value === "day" || value === "month" ? value : "";
};

export const mcpAssistantClient: AssistantClient = {
  async model() {
    const reply = await callTool("", "ai_list_chat_models", {});
    const items: any[] = Array.isArray(reply?.items) ? reply.items : [];
    const picked = items.find((item) => item?.picked === true) ?? items[0];
    return text(picked?.id);
  },
  ask: askAssistant,
  async reached() {
    try {
      return reachedOf(await callTool("", usageTool, {}));
    } catch {
      return "";
    }
  },
};

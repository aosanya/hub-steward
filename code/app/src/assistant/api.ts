import { callTool, listTools, type ToolInfo } from "../wakala/mcp";

export type Turn = { role: "user" | "assistant"; content: string };

export type AssistantClient = {
  model: () => Promise<string>;
  ask: (accountId: string, turns: Turn[]) => Promise<string>;
};

type Call = { id: string; name: string; arguments: Record<string, unknown> };

type Wire = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_calls?: Call[]; tool_call_id?: string };

export const chatTool = "ai_chat_account";

export const offeredNames = [
  "taskmanager_task_list",
  "taskmanager_task_read",
  "taskmanager_backlog_list",
  "taskmanager_task_state_list",
  "taskmanager_relationship_traverse",
];

export const maxRounds = 6;

export const maxResultLength = 8000;

export const replyTokens = 2048;

export const noAnswerSentence = "The assistant sent no answer.";

export const tooManyRoundsSentence = "I looked things up for several steps and still have no answer. Ask again with a narrower question.";

export const systemPrompt =
  "You are the Triager of this hub's backlogs: the issues loaded from the todo boards, each in one backlog at one step, with tags such as Ready, Blocked and the repo name. Answer the owner's questions by calling the tools you are given, and never name an issue you did not read from a tool. To find issues use taskmanager_task_list with its filters (tag, repo, backlog, step, untouched_days); a tag filter is case-insensitive and several tags must all match. Answer briefly in the language the owner writes in: how many there are, then one line for each issue with its code and title, at most ten, and say when there are more.";

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

export async function askAssistant(accountId: string, turns: Turn[]): Promise<string> {
  const tools = await offeredOf();
  const messages: Wire[] = [{ role: "system", content: systemPrompt }, ...turns.map(({ role, content }) => ({ role, content }))];
  for (let round = 0; round < maxRounds; round++) {
    const args: Record<string, unknown> = { accountID: accountId, messages: [...messages], max_tokens: replyTokens };
    if (tools.length > 0) args.tools = tools;
    const answer = await callTool("", chatTool, args);
    const message = isObject(answer?.message) ? answer.message : {};
    const calls = callsOf(message.tool_calls);
    const content = text(message.content).trim();
    if (calls.length === 0) {
      if (content === "") throw new Error(noAnswerSentence);
      return content;
    }
    messages.push({ role: "assistant", content, tool_calls: calls });
    for (const call of calls) {
      const allowed = offeredNames.includes(call.name);
      const result = allowed
        ? await callTool("", call.name, call.arguments).then(resultText, (failure: Error) => `The call failed: ${failure.message}`)
        : "That tool is not available.";
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  return tooManyRoundsSentence;
}

export const mcpAssistantClient: AssistantClient = {
  async model() {
    const reply = await callTool("", "ai_list_chat_models", {});
    const items: any[] = Array.isArray(reply?.items) ? reply.items : [];
    const picked = items.find((item) => item?.picked === true) ?? items[0];
    return text(picked?.id);
  },
  ask: askAssistant,
};

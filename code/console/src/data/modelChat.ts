import {
  McpError,
  callTool,
  isReadTool,
  listTools,
  type ToolInfo,
} from "../wakala/mcp";
import { actionToolsOf, type ActionTool } from "./chatActions";
import type { CallLog, ChatAnswer, Reply } from "./chatAnswer";
import {
  goalPlansOf,
  profileFillOf,
  scenarioFillOf,
  suggestionsFillOf,
  workflowFillOf,
} from "./chatFill";
import { createGoals } from "./pages/goalsCreate";
import { objectivesOverview } from "./chatOverview";
import { workingDraftId } from "./draft";
import { workingDraft } from "./pages/workflowDesign";
import {
  areaOf,
  createGoalsTool,
  readOverviewToolOf,
  directToolOf,
  draftArgument,
  firstSentence,
  formToolOf,
  inFamily,
  showProfileFormTool,
  showScenarioFormTool,
  showSuggestionsTool,
  showWorkflowFormTool,
  specOf,
  suggestToolsOf,
  suggestionsToolOf,
  takesDraft,
  toolFamilyOf,
  writeToolsOf,
  type ToolSpec,
} from "./chatTools";

export type Turn = {
  role: "user" | "assistant";
  content: string;
  shown?: string;
  calls?: CallLog[];
  answer?: ChatAnswer;
  newTopic?: boolean;
};

type Call = { id: string; name: string; arguments: Record<string, unknown> };

type Wire = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Call[];
  tool_call_id?: string;
};

type Offered = {
  specs: ToolSpec[];
  names: Set<string>;
  tools: ToolInfo[];
  form: ToolSpec | null;
  direct: ToolSpec | null;
  suggest: ToolSpec | null;
  overview: ToolSpec | null;
  actions: ActionTool[];
  writes: Map<string, ToolInfo>;
};

type Answer = { message?: { content?: unknown; tool_calls?: unknown } };

export const chatTool = "ai_chat_account";

export const maxRounds = 6;

export const maxResultLength = 8000;

export const maxOfferedTools = 30;

export const replyTokens = 4096;

export {
  createGoalsTool,
  showProfileFormTool,
  showScenarioFormTool,
  showWorkflowFormTool,
};

export const showToolsTool = "show_my_tools";

export const newTopicTool = "start_new_topic";

export const maxContextTurns = 10;

export const maxSummaryLength = 60;

export const noModelSentence =
  "no model is ready for the chat yet: add one on the Models page and allow it in the chat";

export const noAnswerSentence = "the model sent no answer";

export const tooManyRoundsSentence = `I looked things up for ${maxRounds} steps and still have no answer. Ask again with a narrower question.`;

export const suggestNudge = `You have looked things up enough. Call ${showSuggestionsTool} now with every suggestion you can make from what you read, and then reply with a short summary.`;

export const suggestionsLeftSentence =
  "The suggestions are in the Chat response tab, to apply or dismiss.";

const accountArgument = "accountID";

const hubArgument = "instance_id";

const systemPrompt = `You assist the manager of this hub. Use the tools you are given to look facts up, and where one tool returns everything at once, use it instead of looking things up one at a time. The tools that read only look things up. Where you are given tools that create, update or set something, they change the agency right away in its working draft, which goes live only when the manager publishes: when asked to create or change something, do not ask questions and do not describe it, read what exists, then call the tool with your best effort and say in one sentence what you did. An objective is delivered by workflows, linked to it with the workflow-objective tools; a responsible, accountable, consulted or informed role is set on a step of a workflow, not on the objective; a workflow with no objective stops the agency from being published. When you have no tool for a change, say so. When asked which tools or abilities you have, call ${showToolsTool} instead of listing them. When asked to add a workflow, a cancel workflow or a scenario, or to rename the agency or change its Purpose, look up what exists, then call the form tool you are given to fill the form in the content area: nothing is recorded until the manager presses Save, so tell the manager to check it and press Save. If the manager's newest message is about a different subject than the earlier messages, call ${newTopicTool} first so the old messages are dropped; never call it when the message continues the earlier subject. When asked to create, generate or add goals, do not ask questions and do not fill a form: read the agency and its existing goals, then call ${createGoalsTool} once with your best goals, and say in one sentence what you created. When asked to review, check or improve what is on the page and you are given ${showSuggestionsTool}, read it, then call ${showSuggestionsTool} once with every suggestion, each with the tool and arguments that carry it out and, when one change is not enough, the further changes in then (a merge updates the item that is kept and then deletes the duplicate), and then reply with a short summary of what the review found, two sentences at most, that points to the Chat response tab, without listing the suggestions again. When asked to create, analyse or add risks and you are given agency_create_risk, do not ask questions: read the agency and the risks already recorded, then call agency_create_risk once per risk with title, top_event, hazard and owner (a role name), and for each risk call agency_create_risk_pathway with the risk_id it returned, side threat or consequence, a title and a scenario, for two or three threats and two or three consequences. They are recorded in the working draft at once, so say in one sentence what you created. When attaching a control, set target_id to the id the list tools return for the threat, consequence or other thing it guards, never its code such as T-3 or C-4. Never say you will change something without calling the tool for it in the same turn: calling it is the only way the change happens. Answer briefly, in the language the manager writes in.`;

export const backgroundIntro =
  "Background for this turn, read from the agency's working draft. Use it to review the page against the rest of the draft, do not repeat it to the manager, and look up more only if it is not enough:";

const showToolsSpec: ToolSpec = {
  name: showToolsTool,
  description:
    "Shows the manager, in the content area next to this chat, the list of the tools you can use on this page. Call it whenever the manager asks what tools, abilities or functions you have, in any language.",
  parameters: { type: "object", properties: {}, required: [] },
};

const newTopicSpec: ToolSpec = {
  name: newTopicTool,
  description:
    "Call this when the manager's newest message is about a different subject than the earlier messages. The earlier messages are then forgotten and only the newest message is kept.",
  parameters: { type: "object", properties: {}, required: [] },
};

export function contextOf(turns: Turn[]): Turn[] {
  const start = turns.map((turn) => !!turn.newTopic).lastIndexOf(true);
  const since = start < 0 ? turns : turns.slice(start);
  const recent = since.slice(-maxContextTurns);
  const first = recent.findIndex((turn) => turn.role === "user");
  return first < 0 ? [] : recent.slice(first);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const contentOf = (value: unknown): string =>
  Array.isArray(value)
    ? value
        .map((part) => (isObject(part) ? textOf(part.text) : textOf(part)))
        .join("")
    : textOf(value);

export const answerNudge = "Answer the manager now, in one short sentence.";

export const formNudge = (tool: string) =>
  `If the manager asked for a change, call ${tool} now with the complete new text instead of describing it. If not, repeat your answer.`;

const argumentsOf = (value: unknown): Record<string, unknown> => {
  if (isObject(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const maxRawLength = 400;

const rawOf = (answer: unknown) =>
  (JSON.stringify(answer) ?? "").slice(0, maxRawLength);

const callsOf = (value: unknown): Call[] =>
  (Array.isArray(value) ? value : [])
    .filter(isObject)
    .filter((call) => textOf(call.name) !== "")
    .map((call, index) => ({
      id: textOf(call.id) || `call-${index}`,
      name: textOf(call.name),
      arguments: argumentsOf(call.arguments),
    }));

async function offeredTools(page: string, history: boolean): Promise<Offered> {
  const all = await listTools().catch((): ToolInfo[] => []);
  const family = toolFamilyOf(page);
  const form = formToolOf(page);
  const direct = directToolOf(page);
  const suggest = suggestionsToolOf(page, all, hubArgument);
  const overview = readOverviewToolOf(page);
  const actions = actionToolsOf(page);
  const base = history ? [showToolsSpec, newTopicSpec] : [showToolsSpec];
  const writeNames = new Set(writeToolsOf(page));
  const writes = new Map(
    all
      .filter((tool) => writeNames.has(tool.name))
      .map((tool) => [tool.name, tool]),
  );
  const writeSpecs = [...writes.values()].map((tool) =>
    specOf(tool, hubArgument, [draftArgument]),
  );
  const extra = [
    ...base,
    ...writeSpecs,
    ...(form ? [form] : []),
    ...(direct ? [direct] : []),
    ...(suggest ? [suggest] : []),
    ...(overview ? [overview] : []),
    ...actions.map((action) => action.spec),
  ];
  const read = all
    .filter(
      (tool) =>
        isReadTool(tool.name) &&
        tool.name !== chatTool &&
        inFamily(tool.name, family),
    )
    .slice(0, Math.max(0, maxOfferedTools + 1 - extra.length));
  return {
    form,
    direct,
    suggest,
    overview,
    actions,
    writes,
    specs:
      read.length > 0
        ? [
            ...read.map((tool) => specOf(tool, hubArgument, [draftArgument])),
            ...extra,
          ]
        : [],
    names: new Set(read.map((tool) => tool.name)),
    tools: read,
  };
}

const clipped = (value: string) =>
  value.length > maxResultLength
    ? `${value.slice(0, maxResultLength)}…`
    : value;

type Ran = { content: string; failed: boolean };

async function runTool(
  hubId: string,
  call: Call,
  offered: Offered,
  draftOf: () => Promise<string>,
): Promise<Ran> {
  if (!offered.names.has(call.name))
    return { content: `the tool ${call.name} is not available`, failed: true };
  try {
    const tool = offered.tools.find((entry) => entry.name === call.name);
    const draftId = tool && takesDraft(tool) ? await draftOf() : "";
    const draft = draftId === "" ? {} : { [draftArgument]: draftId };
    const result = await callTool(hubId, call.name, {
      ...call.arguments,
      ...draft,
      [hubArgument]: hubId,
    });
    return { content: clipped(JSON.stringify(result) ?? ""), failed: false };
  } catch (error) {
    return {
      content: clipped(
        error instanceof Error ? error.message : "the tool failed",
      ),
      failed: true,
    };
  }
}

async function runWrite(
  hubId: string,
  call: Call,
  tool: ToolInfo,
): Promise<Ran> {
  try {
    const draft = takesDraft(tool)
      ? { [draftArgument]: await workingDraft(hubId) }
      : {};
    const result = await callTool(hubId, call.name, {
      ...call.arguments,
      ...draft,
      [hubArgument]: hubId,
    });
    return { content: clipped(JSON.stringify(result) ?? ""), failed: false };
  } catch (error) {
    return {
      content: clipped(
        error instanceof Error ? error.message : "the change could not be made",
      ),
      failed: true,
    };
  }
}

async function overviewOf(hubId: string, call: Call): Promise<Ran> {
  try {
    return {
      content: clipped(
        JSON.stringify(await objectivesOverview(hubId, call.arguments)) ?? "",
      ),
      failed: false,
    };
  } catch (error) {
    return {
      content: clipped(
        error instanceof Error
          ? error.message
          : "the objectives could not be read",
      ),
      failed: true,
    };
  }
}

async function createdBy(hubId: string, call: Call): Promise<Ran> {
  try {
    const made = await createGoals(hubId, goalPlansOf(call.arguments));
    const failed =
      made.failed.length > 0
        ? ` These could not be created: ${made.failed.join(", ")}.`
        : "";
    return {
      content: `Created ${made.goals.length} goals and ${made.objectives} objectives, now on the Goals page.${failed} Say in one short sentence what you created.`,
      failed: false,
    };
  } catch (error) {
    return {
      content: clipped(
        error instanceof Error
          ? error.message
          : "the goals could not be created",
      ),
      failed: true,
    };
  }
}

const promptOf = (turns: Turn[]): string =>
  [...turns].reverse().find((turn) => turn.role === "user")?.content ?? "";

const toolsAnswer = (prompt: string, tools: ToolInfo[]): ChatAnswer => ({
  kind: "tools",
  prompt,
  rows: tools.map((tool) => ({
    name: tool.name,
    summary: firstSentence(tool.description),
    area: areaOf(tool.name),
  })),
});

const formAnswer = (prompt: string, form: ToolSpec, call: Call): ChatAnswer => {
  if (form.name === showWorkflowFormTool)
    return {
      kind: "form",
      form: "workflow",
      prompt,
      fill: workflowFillOf(call.arguments),
    };
  if (form.name === showProfileFormTool)
    return {
      kind: "form",
      form: "profile",
      prompt,
      fill: profileFillOf(call.arguments),
    };
  return {
    kind: "form",
    form: "scenario",
    prompt,
    fill: scenarioFillOf(call.arguments),
  };
};

const suggestionsShownSentence = (count: number) =>
  `The Chat response tab with ${count} suggestions is now open beside the page in the content area, and nothing has been changed. Do not list the suggestions: reply with a short summary of what the review found, two sentences at most, and say the suggestions are in the Chat response tab to apply or dismiss.`;

const actionShownSentence =
  "The form or card is now shown to the manager in the content area and nothing is recorded yet. Do not repeat it: say in one short sentence that it is there to check and that pressing its button records it.";

const formShownSentence =
  "The filled form is now shown to the manager in the content area and nothing is recorded yet. Do not repeat it: say in one short sentence that it is there to check and that Save records it.";

const shownSentence = (count: number) =>
  `The list of ${count} tools is now shown to the manager in the content area. Do not repeat it: say in one short sentence that it is there.`;

const summaryOf = (call: Call): string => {
  const { [hubArgument]: _hub, ...rest } = call.arguments;
  const text = Object.entries(rest)
    .map(
      ([key, value]) =>
        `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`,
    )
    .join(" ");
  return text.length > maxSummaryLength
    ? `${text.slice(0, maxSummaryLength - 1)}…`
    : text;
};

export async function askModel(
  hubId: string,
  accountId: string,
  turns: Turn[],
  page = "",
  background = "",
  signal?: AbortSignal,
): Promise<Reply> {
  if (accountId === "") throw new McpError(noModelSentence);
  const context = contextOf(turns);
  const offered = await offeredTools(page, context.length > 1);
  const messages: Wire[] = [
    { role: "system", content: background === "" ? systemPrompt : `${systemPrompt}\n\n${backgroundIntro}\n${background}` },
    ...context.map(({ role, content }) => ({ role, content })),
  ];
  const logged: CallLog[] = [];
  let shown: ChatAnswer | undefined;
  let nudged = false;
  let formNudged = false;
  let newTopic = false;
  let changed = false;
  let draftLookup: Promise<string> | null = null;
  const draftOf = () => (draftLookup ??= workingDraftId(hubId));
  for (let round = 0; round < maxRounds; round++) {
    signal?.throwIfAborted();
    const reviewing = offered.suggest !== null && !shown;
    if (reviewing && round === maxRounds - 2)
      messages.push({ role: "user", content: suggestNudge });
    const args: Record<string, unknown> = {
      [accountArgument]: accountId,
      messages: [...messages],
      max_tokens: replyTokens,
    };
    if (offered.specs.length > 0)
      args.tools =
        reviewing && offered.suggest && round === maxRounds - 1
          ? [offered.suggest]
          : offered.specs;
    const answer = await (signal
      ? callTool<Answer>(hubId, chatTool, args, signal)
      : callTool<Answer>(hubId, chatTool, args));
    const message = isObject(answer.message) ? answer.message : {};
    const calls = callsOf(message.tool_calls);
    const content = contentOf(message.content).trim();
    if (calls.length === 0) {
      const acting =
        offered.form ?? offered.direct ?? [...offered.writes.values()][0];
      if (
        content !== "" &&
        acting &&
        !shown &&
        !changed &&
        logged.length > 0 &&
        !formNudged
      ) {
        formNudged = true;
        messages.push(
          { role: "assistant", content },
          { role: "user", content: formNudge(acting.name) },
        );
        continue;
      }
      if (content !== "")
        return {
          text: content,
          calls: logged,
          answer: shown,
          ...(newTopic ? { newTopic } : {}),
          ...(changed ? { changed: page } : {}),
        };
      if (nudged) throw new McpError(`${noAnswerSentence}: ${rawOf(answer)}`);
      nudged = true;
      messages.push({ role: "user", content: answerNudge });
      continue;
    }
    if (calls.some((call) => call.name === newTopicTool)) {
      newTopic = true;
      messages.splice(1, messages.length - 1, {
        role: "user",
        content: promptOf(turns),
      });
      continue;
    }
    messages.push({ role: "assistant", content, tool_calls: calls });
    for (const call of calls) {
      signal?.throwIfAborted();
      const started = Date.now();
      let ran: Ran;
      if (call.name === showToolsTool) {
        shown = toolsAnswer(promptOf(turns), offered.tools);
        ran = { content: shownSentence(offered.tools.length), failed: false };
      } else if (offered.form && call.name === offered.form.name) {
        shown = formAnswer(promptOf(turns), offered.form, call);
        ran = { content: formShownSentence, failed: false };
      } else if (offered.actions.some((action) => action.spec.name === call.name)) {
        const action = offered.actions.find((entry) => entry.spec.name === call.name) as ActionTool;
        shown = action.answer(promptOf(turns), call.arguments);
        ran = { content: actionShownSentence, failed: false };
      } else if (offered.overview && call.name === offered.overview.name) {
        ran = await overviewOf(hubId, call);
      } else if (offered.suggest && call.name === offered.suggest.name) {
        const fill = suggestionsFillOf(
          page,
          call.arguments,
          suggestToolsOf(page),
        );
        shown = { kind: "suggestions", prompt: promptOf(turns), fill };
        ran = {
          content: suggestionsShownSentence(fill.items.length),
          failed: false,
        };
      } else if (offered.direct && call.name === offered.direct.name) {
        ran = await createdBy(hubId, call);
        changed = changed || !ran.failed;
      } else if (offered.writes.has(call.name)) {
        ran = await runWrite(
          hubId,
          call,
          offered.writes.get(call.name) as ToolInfo,
        );
        changed = changed || !ran.failed;
      } else {
        ran = await runTool(hubId, call, offered, draftOf);
      }
      logged.push({
        name: call.name,
        summary: summaryOf(call),
        state: ran.failed ? "error" : "done",
        ms: Date.now() - started,
      });
      messages.push({
        role: "tool",
        content: ran.content,
        tool_call_id: call.id,
      });
    }
  }
  return {
    text:
      shown?.kind === "suggestions"
        ? suggestionsLeftSentence
        : tooManyRoundsSentence,
    calls: logged,
    answer: shown,
    ...(newTopic ? { newTopic } : {}),
    ...(changed ? { changed: page } : {}),
  };
}

import { subjectNouns, type ChatAbout } from "../../app/chatAbout";
import { residentChoices, residentNamesFor, residentPrompt, residentReadScopes, residentReadsWords, residentStepWords, scopedToResident } from "./residentReads";

type Kind = ChatAbout["kind"];

type Scoped = Record<string, (about: ChatAbout) => string>;

type Subject = {
  reads: Record<string, Scoped>;
  steps: Record<string, string>;
  choices: string[];
  reading: string;
  overview: string;
  empty: string;
};

const byId: Scoped[string] = (about) => about.id;

const extraOf = (key: string): Scoped[string] => (about) => about.extra?.[key] ?? "";

const personReads: Record<string, Scoped> = Object.fromEntries(Object.entries(residentReadScopes).map(([tool, key]) => [tool, { [key]: byId }]));

const group: Subject = {
  reads: {
    actor_get_group: { group_id: byId },
    actor_get_group_population: { group_id: byId },
    comm_chat_thread_list: { structure_id: byId },
    comm_chat_message_list: { structure_id: byId },
  },
  steps: {
    actor_get_group: "Reading the group's details",
    actor_get_group_population: "Counting the group's members",
    comm_chat_thread_list: "Reading the group's conversations",
    comm_chat_message_list: "Reading the group's messages",
  },
  choices: ["Details", "Members", "Conversation"],
  reading:
    "Details means actor_get_group, Members means actor_get_group_population, and Conversation means comm_chat_thread_list and then comm_chat_message_list with the thread id you read.",
  overview: "call actor_get_group, actor_get_group_population and comm_chat_thread_list at once and answer with the group's name, how people join, whether it is hidden, the member count and the most recent message",
  empty: "its details, members and conversation",
};

const registration: Subject = {
  reads: { ...personReads, actor_get_join_request: { request_id: extraOf("request") } },
  steps: { ...residentStepWords, actor_get_join_request: "Reading the request" },
  choices: ["Request", "Bills", "Holdings", "Applications", "Wishes and issues"],
  reading:
    "Request means actor_get_join_request, bills means accounting_bill_list, holdings digitaltwin_tenure_list, applications forms_submission_list_of_person, and wishes and issues forms_catalog_raised_item_list_of_person.",
  overview: "call the five reads at once and answer with the request and, for each of the other reads, its count and the most recent item",
  empty: "the request, bills, holdings, applications and raised items",
};

const conversation: Subject = {
  reads: { comm_chat_message_list: { structure_id: byId, thread_id: extraOf("thread") } },
  steps: { comm_chat_message_list: "Reading the latest messages" },
  choices: ["Latest messages"],
  reading: "Latest messages means comm_chat_message_list.",
  overview: "call comm_chat_message_list and answer with how many messages there are and what the most recent ones say",
  empty: "its latest messages",
};

const record: Subject = {
  reads: {
    forms_submission_list_of_person: { member_id: extraOf("owner"), record_row_id: byId },
    digitaltwin_tenure_list: { holder_record_row_id: byId },
    audit_list_entries: { subject: byId },
  },
  steps: {
    forms_submission_list_of_person: "Reading its licence and permit applications",
    digitaltwin_tenure_list: "Reading its holdings",
    audit_list_entries: "Reading its activity",
  },
  choices: ["Details", "Licences and permits", "Holdings", "Activity"],
  reading:
    "Details are given to you in this conversation, so answer them without a tool. Licences and permits means forms_submission_list_of_person, holdings digitaltwin_tenure_list, and activity audit_list_entries.",
  overview: "call the three reads at once and answer with its details and, for each read, its count and the most recent item",
  empty: "its details, licences and permits, holdings and activity",
};

const user: Subject = {
  reads: {
    actor_get_actor_standing: { actor_id: byId },
    actor_get_actor: { actor_id: byId },
    audit_list_entries: { subject: byId },
  },
  steps: {
    actor_get_actor_standing: "Reading their roles",
    actor_get_actor: "Reading their details",
    audit_list_entries: "Reading their activity",
  },
  choices: ["Roles", "Details", "Activity"],
  reading: "Roles means actor_get_actor_standing, Details means actor_get_actor, and Activity means audit_list_entries.",
  overview: "call actor_get_actor_standing, actor_get_actor and audit_list_entries at once and answer with their roles, their details and the most recent activity",
  empty: "their roles, details and activity",
};

const boundary: Subject = {
  reads: {
    actor_get_group: { group_id: byId },
    actor_get_group_population: { group_id: byId },
  },
  steps: {
    actor_get_group: "Reading the boundary's details",
    actor_get_group_population: "Counting the residents inside it",
  },
  choices: ["Details", "Residents"],
  reading: "Details means actor_get_group and Residents means actor_get_group_population.",
  overview: "call actor_get_group and actor_get_group_population at once and answer with its name, its area node and how many residents it holds",
  empty: "its details and residents",
};

const integration: Subject = {
  reads: { ai_get_account: { accountID: byId } },
  steps: { ai_get_account: "Reading the integration's details" },
  choices: ["Details", "Limits"],
  reading: "Details and Limits both mean ai_get_account. Never state a key or a secret; say only whether a key is connected.",
  overview: "call ai_get_account and answer with its provider, address, model, whether it is connected and its limits",
  empty: "its details and limits",
};

const aiAgent: Subject = {
  reads: { ai_usage_breakdown: { role_id: byId } },
  steps: { ai_usage_breakdown: "Reading what the agent used this month" },
  choices: ["Use this month", "Limits"],
  reading: "Use this month means ai_usage_breakdown with window month. Its limits are given to you in this conversation, so answer them without a tool.",
  overview: "call ai_usage_breakdown with window month and answer with the tokens and requests it used and who used them",
  empty: "its limits and use this month",
};

const subjects: Record<Exclude<Kind, "resident">, Subject> = { group, registration, conversation, business: record, trader: record, user, boundary, integration, "ai-agent": aiAgent };

const subjectOf = (about: ChatAbout | null) => (about && about.kind !== "resident" ? subjects[about.kind] : null);

export const aboutLabel = (about: ChatAbout) => (about.kind === "registration" ? `the registration of ${about.name}${about.extra?.group ? ` for ${about.extra.group}` : ""}` : about.name);

export const readNamesFor = (about: ChatAbout | null): string[] => {
  if (!about) return [];
  const subject = subjectOf(about);
  return subject ? Object.keys(subject.reads) : residentNamesFor(about);
};

export const scopeKeysFor = (about: ChatAbout | null, tool: string): string[] => {
  const subject = subjectOf(about);
  if (subject) return Object.keys(subject.reads[tool] ?? {});
  const key = about ? residentReadScopes[tool] : undefined;
  return key ? [key] : [];
};

export const scopedArgs = (about: ChatAbout | null, tool: string, args: Record<string, unknown>): Record<string, unknown> => {
  const subject = subjectOf(about);
  if (!about || !subject) return scopedToResident(about, tool, args);
  const scope = subject.reads[tool] ?? {};
  return { ...args, ...Object.fromEntries(Object.entries(scope).map(([key, value]) => [key, value(about)])) };
};

export const stepWordsFor = (about: ChatAbout | null): Record<string, string> => subjectOf(about)?.steps ?? residentStepWords;

export const choicesFor = (about: ChatAbout): string[] => subjectOf(about)?.choices ?? residentChoices;

export const readsWordsFor = (about: ChatAbout): string =>
  subjectOf(about)
    ? `For this ${subjectNouns[about.kind as Exclude<Kind, "resident">]} you can read only what the tools you are given return; they already cover only this ${subjectNouns[about.kind as Exclude<Kind, "resident">]}, so never ask for an id. Say you cannot read anything else about it, and when a read is refused say you could not read that part.`
    : residentReadsWords;

export const placeholderFor = (about: ChatAbout) => `Ask about ${about.name}`;

export const emptyWordsFor = (about: ChatAbout) => {
  const subject = subjectOf(about);
  return subject ? `Ask about ${about.name}: ${subject.empty}.` : `Ask about ${about.name}: bills, holdings, applications and raised items.`;
};

const invitation = (about: ChatAbout) => `What would you like to see about ${aboutLabel(about)}? Tap one, or write your question.`;

const factsOf = (about: ChatAbout) => {
  if (about.kind === "registration") return ` The request: ${about.name} asked to join ${about.extra?.group ?? "a group"}${about.extra?.asked ? ` on ${about.extra.asked}` : ""}.`;
  if (about.kind === "business" || about.kind === "trader" || about.kind === "integration" || about.kind === "ai-agent") return about.extra?.details ? ` What is on its page: ${about.extra.details}.` : "";
  return "";
};

export const promptFor = (about: ChatAbout): string => {
  const subject = subjectOf(about);
  if (!subject) return residentPrompt(about);
  const choiceLines = subject.choices.map((choice) => `[[${choice}]]`).join(" ");
  return `You are the Hub Steward, talking with the owner about one thing, ${aboutLabel(about)}.${factsOf(about)} Everything in this conversation is about it: answer about it, and never ask the owner what they want to find or offer search readings as choices. Answer briefly in the language the owner writes in. ${subject.reading} Call the one the owner asks for at once and never name a fact you did not read from a tool or were given here. When the owner only greets you or writes something vague, call no tool: answer in one short sentence, exactly "${invitation(about)}", and give the choices, each on its own line, as ${choiceLines}. When the owner asks generally ("tell me about it", "what do you know", "summary"), ${subject.overview}, in plain words, and for a read with nothing on file say there is nothing on file for it; then give the choices as ${choiceLines} for detail. Never write the same reply twice in a row: if you have just given the invitation, answer the next message from the reads instead. You can read only what the tools you are given return. For anything else you cannot read: say so in one plain sentence, and never say there are none, no results or a number you did not get from a tool in this conversation. If a tool call failed or was refused, say you could not read it.`;
};

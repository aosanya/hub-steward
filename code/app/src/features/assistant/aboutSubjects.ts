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

const oneRecord = (tool: string, scope: string, step: string, overview: string): Subject => ({
  reads: { [tool]: { [scope]: byId } },
  steps: { [tool]: step },
  choices: ["Details"],
  reading: `Details means ${tool}.`,
  overview: `call ${tool} and answer with ${overview}`,
  empty: "its details",
});

const place: Subject = {
  reads: { assetmanager_asset_read: { assetID: byId }, digitaltwin_tenure_list: { place_id: extraOf("place") } },
  steps: { assetmanager_asset_read: "Reading the place's details", digitaltwin_tenure_list: "Reading the place's holdings" },
  choices: ["Details", "Holdings"],
  reading: "Details means assetmanager_asset_read and Holdings means digitaltwin_tenure_list.",
  overview: "call assetmanager_asset_read and digitaltwin_tenure_list at once and answer with the place's name, type, location and parcel number and the count and most recent holding",
  empty: "its details and holdings",
};

const address = oneRecord("digitaltwin_address_read", "addressID", "Reading the address", "its street, number, area and postcode");

const holding = oneRecord("digitaltwin_tenure_read", "tenureID", "Reading the holding", "its holder, property, kind and the day it began");

const landUse = oneRecord("digitaltwin_land_use_read", "landUseID", "Reading the land use", "its zone, use and area");

const bill: Subject = {
  reads: {
    accounting_bill_read: { billID: byId },
    accounting_payment_list: { bill_id: byId },
  },
  steps: {
    accounting_bill_read: "Reading the bill",
    accounting_payment_list: "Reading the payments on the bill",
  },
  choices: ["Details", "Payments"],
  reading: "Details means accounting_bill_read and Payments means accounting_payment_list.",
  overview: "call accounting_bill_read and accounting_payment_list at once and answer with the payer, the amount, what is outstanding, when it is due and the most recent payment",
  empty: "its details and payments",
};

const budget: Subject = {
  reads: {
    accounting_budget_read: { budgetID: byId },
    accounting_tender_list: { budget_id: byId },
  },
  steps: {
    accounting_budget_read: "Reading the budget line",
    accounting_tender_list: "Reading the tenders against the budget line",
  },
  choices: ["Details", "Tenders"],
  reading: "Details means accounting_budget_read and Tenders means accounting_tender_list.",
  overview: "call accounting_budget_read and accounting_tender_list at once and answer with the planned, spent and remaining amounts and the tenders",
  empty: "its details and tenders",
};

const tender: Subject = {
  reads: {
    accounting_tender_read: { tenderID: byId },
    accounting_quote_list: { tenderID: byId },
  },
  steps: {
    accounting_tender_read: "Reading the tender",
    accounting_quote_list: "Reading the quotes on the tender",
  },
  choices: ["Details", "Quotes"],
  reading: "Details means accounting_tender_read and Quotes means accounting_quote_list.",
  overview: "call accounting_tender_read and accounting_quote_list at once and answer with the description, when it closes and the quotes",
  empty: "its details and quotes",
};


const staff: Subject = {
  reads: Object.fromEntries(
    ["actor_list_role_assignments_for_actor", "actor_get_actor_standing", "actor_get_actor", "actor_list_groups_for_actor"].map((tool) => [tool, { actor_id: byId }]),
  ),
  steps: {
    actor_list_role_assignments_for_actor: "Reading their seats",
    actor_get_actor_standing: "Reading their standing",
    actor_get_actor: "Reading their details",
    actor_list_groups_for_actor: "Reading their groups",
  },
  choices: ["Seats", "Details", "Groups"],
  reading:
    "Seats means actor_list_role_assignments_for_actor and actor_get_actor_standing, Details means actor_get_actor, and Groups means actor_list_groups_for_actor. Never speak of their bills, holdings or applications: they are not part of this page.",
  overview: "call actor_list_role_assignments_for_actor, actor_get_actor and actor_list_groups_for_actor at once and answer with their seats, their contact details and the groups they belong to",
  empty: "their seats, details and groups",
};

const role: Subject = {
  reads: {
    actor_list_role_holders: { kind_id: byId },
    agency_list_roles: { draft_id: extraOf("draft") },
    agency_list_permissions: {},
  },
  steps: {
    actor_list_role_holders: "Reading who holds the role",
    agency_list_roles: "Reading the role's permissions",
    agency_list_permissions: "Reading the permission names",
  },
  choices: ["Holders", "Approval limits", "Permissions"],
  reading:
    "Holders means actor_list_role_holders, Approval limits means the approval_limit on each seat that actor_list_role_holders returns, and Permissions means agency_list_roles for this role's permissions with agency_list_permissions for what each one means.",
  overview: "call actor_list_role_holders and agency_list_roles at once and answer with who holds the role, each seat's approval limit and the role's permissions",
  empty: "its holders, approval limits and permissions",
};

const meeting: Subject = {
  reads: {
    council_meeting_read: { meetingID: byId },
    council_agenda_read: { meetingID: byId },
    council_minutes_read: { meetingID: byId },
    council_resolution_list: { meeting_id: byId },
  },
  steps: {
    council_meeting_read: "Reading the meeting",
    council_agenda_read: "Reading the agenda",
    council_minutes_read: "Reading the minutes",
    council_resolution_list: "Reading the resolutions passed at the meeting",
  },
  choices: ["Details", "Agenda", "Minutes", "Resolutions"],
  reading: "Details means council_meeting_read, Agenda means council_agenda_read, Minutes means council_minutes_read and Resolutions means council_resolution_list.",
  overview: "call council_meeting_read, council_agenda_read, council_minutes_read and council_resolution_list at once and answer with the meeting's date and place, the agenda items, whether minutes are on file and the resolutions passed",
  empty: "its details, agenda, minutes and resolutions",
};

const resolution: Subject = {
  reads: {
    council_resolution_read: { resolutionID: byId },
    council_meeting_read: { meetingID: extraOf("meeting") },
  },
  steps: {
    council_resolution_read: "Reading the resolution",
    council_meeting_read: "Reading the meeting it was passed at",
  },
  choices: ["Details"],
  reading: "Details means council_resolution_read, and the meeting it was passed at means council_meeting_read.",
  overview: "call council_resolution_read and council_meeting_read at once and answer with the title, the date, the outcome and the meeting it was passed at",
  empty: "its details and the meeting it was passed at",
};

const bylaw: Subject = {
  reads: { council_bylaw_read: { bylawID: byId } },
  steps: { council_bylaw_read: "Reading the bylaw" },
  choices: ["Text"],
  reading: "Text means council_bylaw_read.",
  overview: "call council_bylaw_read and answer with its title, its year and what its text says",
  empty: "its text",
};

const committee: Subject = {
  reads: {
    actor_get_group: { group_id: byId },
    actor_list_role_assignments_for_group: { group_id: byId },
  },
  steps: {
    actor_get_group: "Reading the committee's details",
    actor_list_role_assignments_for_group: "Reading who sits on the committee",
  },
  choices: ["Details", "Members"],
  reading: "Details means actor_get_group and Members means actor_list_role_assignments_for_group.",
  overview: "call actor_get_group and actor_list_role_assignments_for_group at once and answer with the committee's name and who sits on it",
  empty: "its details and members",
};

const periodOf = (index: number): Scoped[string] => (about) => about.id.split("~")[index] ?? "";

const report: Subject = {
  reads: {
    accounting_report_read: { period_start: periodOf(0), period_end: periodOf(1) },
    accounting_report_list: {},
  },
  steps: {
    accounting_report_read: "Reading the report",
    accounting_report_list: "Reading the list of reports",
  },
  choices: ["Figures"],
  reading: "Figures means accounting_report_read.",
  overview: "call accounting_report_read and answer with the period, the planned, spent and difference amounts and the departments",
  empty: "its period, figures and departments",
};

const neighbourhood: Subject = {
  reads: {
    accounting_dimension_totals: { key: () => "neighbourhood", account_type: () => "expense" },
  },
  steps: {
    accounting_dimension_totals: "Reading the spending by neighbourhood",
  },
  choices: ["Spending"],
  reading: "Spending means accounting_dimension_totals; the row whose value is this neighbourhood's name is the one to answer from.",
  overview: "call accounting_dimension_totals and answer from the row for this neighbourhood with what was spent and how many entries make it up",
  empty: "its spending and entries",
};

const asset: Subject = {
  reads: {
    assetmanager_asset_read: { assetID: byId },
    assetmanager_movement_list: { asset_id: byId },
    taskmanager_task_list: { status: () => "completed" },
  },
  steps: {
    assetmanager_asset_read: "Reading the asset's details",
    assetmanager_movement_list: "Reading the asset's movements",
    taskmanager_task_list: "Reading the finished jobs",
  },
  choices: ["Details", "Movements", "Maintenance history"],
  reading:
    "Details means assetmanager_asset_read, Movements means assetmanager_movement_list, and Maintenance history means taskmanager_task_list with status completed, keeping only the jobs whose linked_ref is this asset's id, newest first.",
  overview: "call assetmanager_asset_read, assetmanager_movement_list and taskmanager_task_list at once and answer with the asset's name, code, category and condition, its latest movement and its latest finished job",
  empty: "its details, movements and maintenance history",
};

const workorder: Subject = {
  reads: {
    taskmanager_task_read: { taskID: byId },
    taskmanager_agent_list: {},
  },
  steps: {
    taskmanager_task_read: "Reading the work order",
    taskmanager_agent_list: "Reading who can be assigned",
  },
  choices: ["Details", "Assignee"],
  reading: "Details means taskmanager_task_read, and Assignee means the assigned_to and assignee_kind of taskmanager_task_read, with the name taken from taskmanager_agent_list when the assignee is a worker.",
  overview: "call taskmanager_task_read and taskmanager_agent_list at once and answer with the work order's title, state, due day and who it is assigned to",
  empty: "its details and assignee",
};

const application: Subject = {
  reads: {
    forms_submission_read_mine: { form_id: byId },
    forms_question_list: { form_id: byId },
    forms_answer_list: { form_id: byId },
  },
  steps: {
    forms_submission_read_mine: "Reading the application's decision",
    forms_question_list: "Reading the application's questions",
    forms_answer_list: "Reading the application's answers",
  },
  choices: ["Answers", "Decision", "Status"],
  reading:
    "Answers means forms_question_list and forms_answer_list, matching each answer to its question by question_id. Decision and Status mean forms_submission_read_mine: its decision, the note, who decided and when, the certificate lines, and a withdrawn_at day means it was withdrawn.",
  overview: "call forms_submission_read_mine, forms_question_list and forms_answer_list at once and answer with the status, the decision and the answers given to each question",
  empty: "its answers, decision and status",
};

const entryReads: Subject["reads"] = {
  forms_catalog_entry_read: { slug: byId },
  forms_catalog_entry_submissions_mine: { slug: byId },
};

const entryReadSteps: Subject["steps"] = {
  forms_catalog_entry_read: "Reading the entry",
  forms_catalog_entry_submissions_mine: "Reading the applications you sent to it",
};

const permit: Subject = {
  reads: { ...entryReads, forms_submission_list: { form_id: extraOf("form") } },
  steps: { ...entryReadSteps, forms_submission_list: "Reading the applications received" },
  choices: ["Applications", "Granted", "Dates"],
  reading:
    "Applications means forms_catalog_entry_submissions_mine and forms_submission_list, Granted means the applications in forms_submission_list whose decision is approved, and Dates means the days in forms_catalog_entry_submissions_mine and the end days on the certificates. forms_submission_list is refused unless the owner may read the results: then say you could not read the received applications.",
  overview: "call forms_catalog_entry_read, forms_catalog_entry_submissions_mine and forms_submission_list at once and answer with what it is, the applications sent, how many were received and how many were granted",
  empty: "its applications, who was granted and the dates",
};

const fee: Subject = {
  reads: { ...entryReads, forms_form_read: { form_id: extraOf("form") }, actor_get_actor: { actor_id: extraOf("payer") } },
  steps: { ...entryReadSteps, forms_form_read: "Reading the amount", actor_get_actor: "Reading the payer's name" },
  choices: ["Amount", "Payer", "Paid"],
  reading: "Amount means forms_form_read, Payer means actor_get_actor, and Paid means the paid and paid_at of the send in forms_catalog_entry_submissions_mine.",
  overview: "call forms_catalog_entry_read, forms_catalog_entry_submissions_mine, forms_form_read and actor_get_actor at once and answer with what the fee is for, the amount, who pays it and whether it is paid",
  empty: "its amount, payer and whether it is paid",
};

const service: Subject = {
  reads: { forms_catalog_entry_read: { slug: byId } },
  steps: { forms_catalog_entry_read: "Reading the service" },
  choices: ["Summary", "Form"],
  reading: "Summary and Form both mean forms_catalog_entry_read: its summary, its kind and the form behind it.",
  overview: "call forms_catalog_entry_read and answer with what the service is, its kind and the form behind it",
  empty: "its summary and form",
};

const issue: Subject = {
  reads: {
    forms_catalog_reply_list: { raisedItemID: byId },
    forms_catalog_board_item_read: { boardItemID: extraOf("board") },
  },
  steps: {
    forms_catalog_reply_list: "Reading the replies",
    forms_catalog_board_item_read: "Reading the wish it is grouped under",
  },
  choices: ["Details", "Replies"],
  reading:
    "Details are given to you in this conversation, so answer them without a tool; when it is grouped under a wish, forms_catalog_board_item_read reads that wish. Replies means forms_catalog_reply_list. Never say who raised it.",
  overview: "call forms_catalog_reply_list and answer with its details and how many replies there are and what the most recent says",
  empty: "its details and replies",
};

const wish: Subject = {
  reads: {
    forms_catalog_board_item_read: { boardItemID: byId },
    forms_catalog_endorsement_count: { subject_id: byId },
  },
  steps: {
    forms_catalog_board_item_read: "Reading the wish",
    forms_catalog_endorsement_count: "Counting who said Me too",
  },
  choices: ["Details", "Raised by", "Said Me too"],
  reading:
    "Details and Raised by mean forms_catalog_board_item_read, which says how many people raised it and its outcome, and Said Me too means forms_catalog_endorsement_count. Never name a person.",
  overview: "call forms_catalog_board_item_read and forms_catalog_endorsement_count at once and answer with its title, how many people raised it, how many said Me too and its outcome",
  empty: "its details, who raised it and who said Me too",
};

const subjects: Record<Exclude<Kind, "resident">, Subject> = { group, registration, conversation, business: record, trader: record, user, boundary, integration, "ai-agent": aiAgent, place, address, holding, "land-use": landUse, bill, budget, tender, staff, role, report, neighbourhood, meeting, resolution, bylaw, committee, asset, workorder, application, permit, licence: permit, fee, service, issue, wish };

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
  if (about.kind === "business" || about.kind === "trader" || about.kind === "integration" || about.kind === "ai-agent" || about.kind === "issue") return about.extra?.details ? ` What is on its page: ${about.extra.details}.` : "";
  return "";
};

export const promptFor = (about: ChatAbout): string => {
  const subject = subjectOf(about);
  if (!subject) return residentPrompt(about);
  const choiceLines = subject.choices.map((choice) => `[[${choice}]]`).join(" ");
  return `You are the Hub Steward, talking with the owner about one thing, ${aboutLabel(about)}.${factsOf(about)} Everything in this conversation is about it: answer about it, and never ask the owner what they want to find or offer search readings as choices. Answer briefly in the language the owner writes in. ${subject.reading} Call the one the owner asks for at once and never name a fact you did not read from a tool or were given here. When the owner only greets you or writes something vague, call no tool: answer in one short sentence, exactly "${invitation(about)}", and give the choices, each on its own line, as ${choiceLines}. When the owner asks generally ("tell me about it", "what do you know", "summary"), ${subject.overview}, in plain words, and for a read with nothing on file say there is nothing on file for it; then give the choices as ${choiceLines} for detail. Never write the same reply twice in a row: if you have just given the invitation, answer the next message from the reads instead. You can read only what the tools you are given return. For anything else you cannot read: say so in one plain sentence, and never say there are none, no results or a number you did not get from a tool in this conversation. If a tool call failed or was refused, say you could not read it.`;
};

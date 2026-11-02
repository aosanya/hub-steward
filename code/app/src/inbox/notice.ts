import type { Words } from "../entry/words";
import type { NotificationItem } from "./api";
import { firstFilled } from "./chatNotice";

type Naming = { from: readonly string[]; words: keyof Words };

type Wording = { title: keyof Words; titleNamed?: Naming; line?: keyof Words; lineNamed?: Naming };

const group = ["group", "structure"] as const;

const joined: Wording = { title: "inboxJoinedGroup", titleNamed: { from: group, words: "inboxJoinedNamed" }, line: "inboxJoinApprovedLine" };
const invited: Wording = { title: "inboxInvited", titleNamed: { from: ["role", "role_kind", ...group], words: "inboxInvitedNamed" } };
const newForm: Wording = { title: "inboxNewForm" };

export const noticeWordings = new Map<string, Wording>([
  ["group_join_approved", joined],
  ["group_join_declined", { title: "inboxJoinDeclined" }],
  ["join_requested", { title: "inboxJoinRequested" }],
  ["group_invited", invited],
  ["group_member_removed", { title: "inboxGroupMemberRemoved" }],
  ["survey_reached", newForm],
  ["results_published", { title: "inboxResultsPublished" }],
  ["supplier_approved", { title: "inboxSupplierApproved" }],
  ["ask_waiting", { title: "inboxAskWaiting" }],
  ["ask_answered", { title: "inboxAskAnswered" }],
  ["revision_asked", { title: "inboxRevisionAsked" }],
  ["ask_closed", { title: "inboxAskClosed", line: "inboxAskClosedLine", lineNamed: { from: ["line"], words: "inboxAskClosedLineNamed" } }],
  ["group_order_called_off", { title: "inboxGroupOrderCalledOff", titleNamed: { from: ["product"], words: "inboxGroupOrderCalledOffNamed" } }],
  ["notice_posted", { title: "inboxNoticePosted" }],
  ["quote_sent", { title: "inboxQuoteSent" }],
  ["draft_waiting", { title: "inboxDraftWaiting" }],
  ["counter_sent", { title: "inboxCounterSent" }],
  ["case_opened", { title: "inboxCaseOpened" }],
  ["case_closed", { title: "inboxCaseClosed" }],
  ["task_assigned", { title: "inboxTaskAssigned" }],
  ["joined", joined],
  ["request_approved", joined],
  ["invited", invited],
  ["form_published", newForm],
  ["new_form", newForm],
]);

const spoken = (n: NotificationItem, words: Words, bare: keyof Words | undefined, named: Naming | undefined) => {
  const name = named ? firstFilled(...named.from.map((key) => n.names[key])) : "";
  if (named && name) return words[named.words].replace("{name}", () => name);
  return bare ? words[bare] : undefined;
};

const approvedBy = (n: NotificationItem) => {
  const by = firstFilled(n.names.person, n.names.approver, n.names.coordinator);
  return [by, firstFilled(n.names.group, n.names.structure)].filter(Boolean).join(" · ") || undefined;
};

export const noticeTitleOf = (n: NotificationItem, words: Words): string | undefined => {
  const wording = noticeWordings.get(n.event);
  return wording ? spoken(n, words, wording.title, wording.titleNamed) : undefined;
};

export const noticeMetaOf = (n: NotificationItem, words: Words): string | undefined => {
  if (n.event === "supplier_approved") return approvedBy(n);
  const wording = noticeWordings.get(n.event);
  return wording ? spoken(n, words, wording.line, wording.lineNamed) : undefined;
};

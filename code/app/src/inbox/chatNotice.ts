import { chatListPath, routes } from "../routes";
import type { Words } from "../entry/words";
import type { NotificationItem } from "./api";

type Wording = { bare: keyof Words; byPerson?: keyof Words };

export const chatWordings = new Map<string, Wording>([
  ["thread_requested", { bare: "inboxThreadRequested", byPerson: "inboxThreadRequestedBy" }],
  ["thread_declined", { bare: "inboxThreadDeclined", byPerson: "inboxThreadDeclinedBy" }],
  ["thread_reply", { bare: "inboxThreadReply", byPerson: "inboxThreadReplyBy" }],
  ["record_message", { bare: "inboxRecordMessage", byPerson: "inboxRecordMessageBy" }],
  ["message_removed", { bare: "inboxMessageRemoved" }],
  ["record_access_ended", { bare: "inboxRecordAccessEnded" }],
]);

export const firstFilled = (...values: (string | undefined)[]) => values.find((value) => Boolean(value)) ?? "";

const personOf = (n: NotificationItem) => firstFilled(n.names.person, n.names.author, n.names.requester);

const groupOf = (n: NotificationItem) => firstFilled(n.names.group, n.names.structure);

export const chatTitleOf = (n: NotificationItem, words: Words): string | undefined => {
  const wording = chatWordings.get(n.event);
  if (!wording) return undefined;
  const person = personOf(n);
  if (person && wording.byPerson) return words[wording.byPerson].replace("{name}", person);
  return words[wording.bare];
};

export const chatMetaOf = (n: NotificationItem): string | undefined => (chatWordings.has(n.event) ? groupOf(n) || undefined : undefined);

export const threadPathOf = (n: NotificationItem): string | undefined => {
  if (n.subjectKind !== "chat_thread" || n.subjectId === "") return undefined;
  return n.structureId ? routes.roomThread.path({ roomId: n.structureId, threadId: n.subjectId }) : chatListPath();
};

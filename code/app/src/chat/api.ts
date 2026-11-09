import { callTool } from "../wakala/mcp";
import { loadSubject } from "../wakala/me";

export type Room = {
  id: string;
  name: string;
  threadId: string;
  threadName: string;
  unread: number;
  preview?: string;
  lastAt?: string;
};

export type ChatMessage = {
  id: string;
  author: string;
  agent: boolean;
  body: string;
  at: string;
  askId: string;
  mine: boolean;
};

export type Ask = { id: string; asker: string; question: string; answer: string; detail: string };

export type AskAnswer = { answer: "yes" | "no"; date?: string; note?: string };

export type ChatClient = {
  listRooms: () => Promise<Room[]>;
  listMessages: (roomId: string, threadId: string) => Promise<ChatMessage[]>;
  getAsk: (askId: string) => Promise<Ask | null>;
  answerAsk: (askId: string, reply: AskAnswer) => Promise<void>;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

const itemsOf = (reply: any): any[] => (Array.isArray(reply?.items) ? reply.items : []);

const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);

export const lastOf = (thread: any) => (thread?.last_message && typeof thread.last_message === "object" ? thread.last_message : undefined);

export const lastAtOf = (thread: any): string => text(lastOf(thread)?.created_at) || text(thread?.last_message_at);

const momentOfStamp = (stamp: string): number => {
  const moment = Date.parse(stamp);
  return Number.isNaN(moment) ? -Infinity : moment;
};

const momentOf = (thread: any): number => momentOfStamp(lastAtOf(thread));

export const previewOf = (message: any, subject: string): string => {
  const body = text(message?.body).trim();
  if (body === "") return "";
  const mine = subject !== "" && text(message?.author_id) === subject;
  const author = mine ? "You" : text(message?.author_name);
  return author ? `${author}: ${body}` : body;
};

const openedThreadOf = (threads: any[]): any => {
  const newest = threads.reduce((best, thread) => (momentOf(thread) > momentOf(best) ? thread : best));
  return momentOf(newest) === -Infinity ? threads.find((thread) => thread?.audience === "group") ?? newest : newest;
};

const roomOf = (group: any, threads: any[], subject: string): Room => {
  if (threads.length === 0) return { id: text(group?.id), name: text(group?.name), threadId: "", threadName: "", unread: 0, preview: "", lastAt: "" };
  const opened = openedThreadOf(threads);
  return {
    id: text(group?.id),
    name: text(group?.name),
    threadId: text(opened?.id),
    threadName: text(opened?.label),
    unread: threads.reduce((total, thread) => total + count(thread?.unread), 0),
    preview: previewOf(lastOf(opened), subject),
    lastAt: lastAtOf(opened),
  };
};

const newestFirst = (a: Room, b: Room) => {
  const [left, right] = [momentOfStamp(a.lastAt ?? ""), momentOfStamp(b.lastAt ?? "")];
  return left < right ? 1 : left > right ? -1 : a.name.localeCompare(b.name);
};

export const roomsOf = (groups: any[], threadsByGroup: any[][], subject = ""): Room[] =>
  groups
    .map((group, i) => ({ group, threads: threadsByGroup[i] ?? [] }))
    .map(({ group, threads }) => roomOf(group, threads, subject))
    .sort(newestFirst);

const messageOf = (subject: string) => (raw: any): ChatMessage => ({
  id: text(raw?.id),
  author: text(raw?.author_name) || text(raw?.author_id),
  agent: false,
  body: text(raw?.body),
  at: text(raw?.created_at),
  askId: raw?.attachment_kind === "ask" ? text(raw?.attachment_id) : "",
  mine: subject !== "" && text(raw?.author_id) === subject,
});

export const isWaiting = (ask: Ask) => ask.answer === "waiting" || ask.answer === "";

export const listAsks = async (): Promise<Ask[]> => itemsOf(await callTool("", "market_list_asks", {})).map(askOf);

const askOf = (raw: any): Ask => ({
  id: text(raw?.id),
  asker: text(raw?.picker_name) || text(raw?.picker),
  question: text(raw?.question),
  answer: text(raw?.answer),
  detail: text(raw?.detail),
});

export const mcpChatClient: ChatClient = {
  async listRooms() {
    const groups = itemsOf(await callTool("", "actor_list_my_groups", {})).filter((g) => text(g?.id) !== "");
    const [reads, subject] = await Promise.all([
      Promise.all(groups.map((g) => callTool("", "comm_chat_thread_list", { structure_id: text(g.id) }).then(itemsOf, () => null))),
      loadSubject().catch(() => ""),
    ]);
    if (reads.length > 0 && reads.every((read) => read === null)) throw new Error("comm_chat_thread_list failed for every group");
    const answered = groups.map((group, i) => ({ group, read: reads[i] })).filter(({ read }) => read !== null);
    return roomsOf(answered.map(({ group }) => group), answered.map(({ read }) => read as any[]), subject);
  },
  async listMessages(roomId, threadId) {
    const [reply, subject] = await Promise.all([
      callTool("", "comm_chat_message_list", { structure_id: roomId, thread_id: threadId }),
      loadSubject(),
    ]);
    return itemsOf(reply).map(messageOf(subject));
  },
  async getAsk(askId) {
    const found = itemsOf(await callTool("", "market_list_asks", {})).find((raw) => text(raw?.id) === askId);
    return found ? askOf(found) : null;
  },
  async answerAsk(askId, reply) {
    await callTool("", "market_answer_ask", {
      askID: askId,
      answer: reply.answer,
      ...(reply.date ? { date: reply.date } : {}),
      ...(reply.note ? { note: reply.note } : {}),
    });
  },
};

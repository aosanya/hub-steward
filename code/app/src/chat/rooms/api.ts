import { callTool } from "../../wakala/mcp";
import { lastAtOf, lastOf, previewOf } from "../api";
import { loadSubject } from "../../wakala/me";
import { groupOrderOf, type GroupOrder } from "../../supply/groupOrder/api";
import { productName, type NamedOffer } from "../../market/productName";

export const attachmentKinds = { groupOrder: "group_order", request: "request", ask: "ask" } as const;

export type RoomThread = {
  id: string;
  label: string;
  audience: "leads" | "group";
  requestedBy: string;
  declined: boolean;
  unread: number;
  lastMessageAt: string;
  preview: string;
};

export type RoomMessage = {
  id: string;
  author: string;
  agent: boolean;
  mine: boolean;
  body: string;
  at: string;
  kind: string;
  targetId: string;
};

export type RoomOrder = { order: GroupOrder; productWords: string; myQuantity: number; myAnswer: string };

export type RoomAsk = {
  id: string;
  mine: boolean;
  posterName: string;
  answer: string;
  question: string;
  detail: string;
  offerId: string;
  productId: string;
  yesId: string;
};

export type RoomsClient = {
  subject: () => Promise<string>;
  roomName: (roomId: string) => Promise<string>;
  listThreads: (roomId: string) => Promise<RoomThread[]>;
  listMessages: (roomId: string, threadId: string) => Promise<RoomMessage[]>;
  post: (roomId: string, threadId: string, body: string) => Promise<void>;
  startThread: (roomId: string, label: string) => Promise<string>;
  getOrder: (orderId: string) => Promise<RoomOrder>;
  answerRevision: (orderId: string, answer: "yes" | "no") => Promise<void>;
  getAsk: (askId: string) => Promise<RoomAsk | null>;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);
const itemsOf = (reply: any): any[] => (Array.isArray(reply?.items) ? reply.items : []);

export const generalOf = (threads: RoomThread[]): RoomThread | undefined => threads.find((t) => t.audience === "group");

export const threadOf = (subject: string) => (raw: any): RoomThread => ({
  id: text(raw?.id),
  label: text(raw?.label),
  audience: raw?.audience === "leads" ? "leads" : "group",
  requestedBy: text(raw?.requested_by),
  declined: text(raw?.declined_at) !== "",
  unread: count(raw?.unread),
  lastMessageAt: lastAtOf(raw),
  preview: previewOf(lastOf(raw), subject),
});

export const messageOf = (subject: string) => (raw: any): RoomMessage => ({
  id: text(raw?.id),
  author: text(raw?.author_name) || text(raw?.author_id),
  agent: raw?.author_kind === "agent",
  mine: subject !== "" && text(raw?.author_id) === subject,
  body: text(raw?.body),
  at: text(raw?.created_at),
  kind: text(raw?.attachment_kind),
  targetId: text(raw?.attachment_id),
});

const namedOfferOf = (raw: any): NamedOffer => ({
  product: text(raw?.product),
  words: text(raw?.product_words),
  price: String(count(raw?.price)),
});

export const orderFor = (subject: string, raw: any, offers: any[] = []): RoomOrder => {
  const own = (Array.isArray(raw?.lines) ? raw.lines : []).find((line: any) => subject !== "" && text(line?.picker) === subject);
  const order = groupOrderOf(raw);
  const productWords = order.product === "" ? "" : productName(order.product, offers.map(namedOfferOf));
  return { order, productWords, myQuantity: count(own?.quantity), myAnswer: text(own?.answer) };
};

export const askFor = (subject: string, posterNames: Map<string, string>, raw: any, yeses: any[] = [], offers: any[] = []): RoomAsk => {
  const yes = yeses.find((candidate) => text(candidate?.ask_id) === text(raw?.id));
  const offerId = text(yes?.offer_id) || text(raw?.offer_id);
  const offer = offers.find((candidate) => offerId !== "" && text(candidate?.id) === offerId);
  return {
    id: text(raw?.id),
    mine: subject !== "" && text(raw?.picker) === subject,
    posterName: posterNames.get(text(raw?.poster_id)) ?? "",
    answer: text(raw?.answer),
    question: text(raw?.question),
    detail: text(raw?.detail),
    offerId,
    productId: offerId === "" ? "" : text(offer?.product) || offerId,
    yesId: text(yes?.id),
  };
};

const listOf = async (tool: string): Promise<any[]> => {
  try {
    return itemsOf(await callTool("", tool, {}));
  } catch {
    return [];
  }
};

const posterNames = async (): Promise<Map<string, string>> => {
  try {
    return new Map(itemsOf(await callTool("", "market_list_posters", {})).map((raw) => [text(raw?.id), text(raw?.name)]));
  } catch {
    return new Map();
  }
};

export const mcpRoomsClient: RoomsClient = {
  subject: loadSubject,
  async roomName(roomId) {
    const group = itemsOf(await callTool("", "actor_list_my_groups", {})).find((raw) => text(raw?.id) === roomId);
    return text(group?.name);
  },
  async listThreads(roomId) {
    const [reply, subject] = await Promise.all([callTool("", "comm_chat_thread_list", { structure_id: roomId }), loadSubject().catch(() => "")]);
    return itemsOf(reply).map(threadOf(subject));
  },
  async listMessages(roomId, threadId) {
    const subject = await loadSubject();
    return itemsOf(await callTool("", "comm_chat_message_list", { structure_id: roomId, thread_id: threadId })).map(messageOf(subject));
  },
  async post(roomId, threadId, body) {
    await callTool("", "comm_chat_message_post", { structure_id: roomId, thread_id: threadId, body });
  },
  async startThread(roomId, label) {
    const started = await callTool("", "comm_chat_thread_create", { structure_id: roomId, label });
    return text(started?.id);
  },
  async getOrder(orderId) {
    const [subject, raw, offers] = await Promise.all([
      loadSubject(),
      callTool("", "market_get_group_order", { groupOrderID: orderId }),
      listOf("market_list_offers"),
    ]);
    return orderFor(subject, raw, offers);
  },
  async answerRevision(orderId, answer) {
    await callTool("", "market_answer_revision", { groupOrderID: orderId, answer });
  },
  async getAsk(askId) {
    const [subject, names, asks, yeses, offers] = await Promise.all([
      loadSubject(),
      posterNames(),
      callTool("", "market_list_asks", {}),
      listOf("market_list_yeses"),
      listOf("market_list_offers"),
    ]);
    const found = itemsOf(asks).find((raw) => text(raw?.id) === askId);
    return found ? askFor(subject, names, found, yeses, offers) : null;
  },
};

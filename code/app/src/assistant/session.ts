import { openAgencyId } from "../agency/open";
import type { Item } from "./queue";

export type Tab = "chat" | "results";

export type Kept = { items: Item[]; last: number; tab: Tab; picked: string; seen: number };

const fresh = (): Kept => ({ items: [], last: 0, tab: "chat", picked: "", seen: 0 });

const conversations = new Map<string, Kept>();

export const keptConversation = (): Kept => conversations.get(openAgencyId()) ?? fresh();

export const keepConversation = (part: Partial<Kept>) => {
  const agency = openAgencyId();
  conversations.set(agency, { ...(conversations.get(agency) ?? fresh()), ...part });
};

export const forgetConversations = () => conversations.clear();

import { useEffect, useSyncExternalStore } from "react";

export type ChatAboutKind = "resident" | "group" | "registration" | "conversation" | "business" | "trader" | "user" | "boundary" | "integration" | "ai-agent" | "place" | "address" | "holding" | "land-use" | "bill" | "budget" | "tender" | "staff" | "role" | "report" | "neighbourhood" | "meeting" | "resolution" | "bylaw" | "committee";

export type ChatAbout = { kind: ChatAboutKind; id: string; name: string; extra?: Record<string, string> };

let open: ChatAbout | null = null;

let openBack = "";

let carried: ChatAbout | null = null;

let carriedFrom = "";

const listeners = new Set<() => void>();

const publish = (next: ChatAbout | null, back = "") => {
  open = next;
  openBack = next ? back : "";
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useChatAbout = () => useSyncExternalStore(subscribe, () => open);

export const useChatAboutOpen = (about: ChatAbout | null, back = "") => {
  const key = about ? `${about.kind}:${about.id}:${about.name}:${JSON.stringify(about.extra ?? {})}` : "";
  useEffect(() => {
    if (!about) return undefined;
    publish(about, back);
    return () => publish(null);
  }, [key, back]);
};

const settle = (about: ChatAbout | null, from: string) => {
  carried = about;
  carriedFrom = about ? from : "";
  listeners.forEach((listener) => listener());
};

export const carryChatAbout = () => settle(open, openBack);

export const carriedChatAbout = () => carried;

export const carriedChatFrom = () => carriedFrom;

export const useCarriedChatAbout = () => useSyncExternalStore(subscribe, () => carried);

export const clearCarriedChatAbout = () => {
  carried = null;
  listeners.forEach((listener) => listener());
};

export const forgetChatAbout = () => {
  open = null;
  settle(null, "");
};

export const subjectNouns: Record<Exclude<ChatAboutKind, "resident">, string> = {
  group: "group",
  registration: "registration request",
  conversation: "group conversation",
  business: "business",
  trader: "informal trader",
  user: "user",
  boundary: "boundary",
  integration: "integration",
  "ai-agent": "AI agent",
  place: "place",
  address: "address",
  holding: "holding",
  "land-use": "land use",
  bill: "bill",
  budget: "budget line",
  tender: "tender",
  staff: "staff member",
  role: "role",
  report: "report",
  neighbourhood: "neighbourhood",
  meeting: "meeting",
  resolution: "resolution",
  bylaw: "bylaw",
  committee: "committee",
};

export const chatAboutWords = (about: ChatAbout) =>
  about.kind === "resident"
    ? `The owner is looking at the resident ${about.name} (resident id ${about.id}). Answer about this resident and keep to them unless the owner asks about something else: a question such as "what do they owe?" means this resident. Use only what the owner could already see on the resident's page.`
    : `The owner is looking at the ${subjectNouns[about.kind]} ${about.name} (id ${about.id}). Answer about this ${subjectNouns[about.kind]} and keep to it unless the owner asks about something else. Use only what the owner could already see on this screen.`;

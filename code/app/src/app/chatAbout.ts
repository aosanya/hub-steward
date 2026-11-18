import { useEffect, useSyncExternalStore } from "react";

export type ChatAbout = { kind: "resident"; id: string; name: string };

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
  const key = about ? `${about.kind}:${about.id}:${about.name}` : "";
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

export const chatAboutWords = (about: ChatAbout) =>
  `The owner is looking at the resident ${about.name} (resident id ${about.id}). Answer about this resident and keep to them unless the owner asks about something else: a question such as "what do they owe?" means this resident. Use only what the owner could already see on the resident's page.`;

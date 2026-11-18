import { useEffect, useSyncExternalStore } from "react";

export type ChatAbout = { kind: "resident"; id: string; name: string };

let open: ChatAbout | null = null;

let carried: ChatAbout | null = null;

const listeners = new Set<() => void>();

const publish = (next: ChatAbout | null) => {
  open = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useChatAbout = () => useSyncExternalStore(subscribe, () => open);

export const useChatAboutOpen = (about: ChatAbout | null) => {
  const key = about ? `${about.kind}:${about.id}:${about.name}` : "";
  useEffect(() => {
    if (!about) return undefined;
    publish(about);
    return () => publish(null);
  }, [key]);
};

export const carryChatAbout = () => {
  carried = open;
};

export const carriedChatAbout = () => carried;

export const forgetChatAbout = () => {
  open = null;
  carried = null;
};

export const chatAboutWords = (about: ChatAbout) =>
  `The owner is looking at the resident ${about.name} (resident id ${about.id}). Questions about this resident mean them. Use only what the owner could already see on the resident's page.`;

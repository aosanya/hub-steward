import { createContext, useContext } from "react";

export type Told = { hubId: string; id: number; text: string; background?: string; afterChange?: () => void; settled?: () => void; shown?: string; typed?: boolean };

export const ChatTellCtx = createContext<(text: string) => void>(() => {});

export const useTellChat = () => useContext(ChatTellCtx);

export type Ask = (text: string, background?: string, afterChange?: () => void, settled?: () => void, shown?: string) => void;

export const ChatAskCtx = createContext<Ask>(() => {});

export const useAskChat = () => useContext(ChatAskCtx);

export const ChatFillCtx = createContext<(text: string) => void>(() => {});

export const useFillChat = () => useContext(ChatFillCtx);

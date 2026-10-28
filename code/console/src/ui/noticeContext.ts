import { createContext, useContext } from "react";
import type { NoticeKind } from "./props";

export type NoticeMessage = { id: number; text: string; kind: NoticeKind };

export type NoticeApi = {
  message: NoticeMessage | null;
  show: (text: string, kind?: NoticeKind) => void;
  dismiss: () => void;
};

export const NoticeCtx = createContext<NoticeApi>({ message: null, show: () => {}, dismiss: () => {} });

export const useNotice = () => useContext(NoticeCtx);

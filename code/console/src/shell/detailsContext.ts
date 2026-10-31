import { createContext, useContext, type ReactNode } from "react";
import type { Suggestion } from "../data/chatAnswer";

export type OpenDetails = (item: Suggestion, actions?: ReactNode) => void;

export const DetailsCtx = createContext<OpenDetails>(() => {});

export const useOpenDetails = () => useContext(DetailsCtx);

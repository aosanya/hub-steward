import { createContext, useContext } from "react";
import type { DraftApi } from "./useDraft";

const quietDraft: DraftApi = { state: "none", ready: false, changes: [], problems: [], version: null, publish: () => {} };

export const DraftCtx = createContext<DraftApi>(quietDraft);

export const useDraftState = () => useContext(DraftCtx);

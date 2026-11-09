import { createContext, useContext, type ReactNode } from "react";

export type BacklogSummary = { id: string; name: string; steps: number; issues: number };

export type BacklogTotals = { issues: number };

type Summaries = { backlogs: BacklogSummary[]; totals: BacklogTotals | null; ready: boolean };

const empty: Summaries = { backlogs: [], totals: null, ready: true };

const SummariesContext = createContext<Summaries>(empty);

export function BacklogSummariesProvider({ backlogs, totals, ready = true, children }: Omit<Summaries, "ready"> & { ready?: boolean; children: ReactNode }) {
  return <SummariesContext.Provider value={{ backlogs, totals, ready }}>{children}</SummariesContext.Provider>;
}

export const useBacklogSummaries = () => useContext(SummariesContext);

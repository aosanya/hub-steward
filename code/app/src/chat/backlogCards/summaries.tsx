import { createContext, useContext, type ReactNode } from "react";

export type BacklogSummary = { id: string; name: string; steps: number; issues: number };

export type BacklogTotals = { issues: number };

type Summaries = { backlogs: BacklogSummary[]; totals: BacklogTotals | null };

const empty: Summaries = { backlogs: [], totals: null };

const SummariesContext = createContext<Summaries>(empty);

export function BacklogSummariesProvider({ backlogs, totals, children }: Summaries & { children: ReactNode }) {
  return <SummariesContext.Provider value={{ backlogs, totals }}>{children}</SummariesContext.Provider>;
}

export const useBacklogSummaries = () => useContext(SummariesContext);

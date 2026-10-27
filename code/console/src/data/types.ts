import type { PageRow, PageSpec } from "../types";

export type Query = Record<string, string>;

export type ActionResult = "done" | "accepted";

export type ActionRun = (hubId: string, values: Record<string, unknown>) => Promise<ActionResult>;

export type PageModule = {
  spec: PageSpec;
  rows: (hubId: string, query: Query) => Promise<PageRow[]>;
  actions?: Record<string, ActionRun>;
};

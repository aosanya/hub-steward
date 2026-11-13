import { callTool } from "../wakala/mcp";

export type LateMatter = { id: string; title: string; place: string; raisedAt: string; daysLate: number; owner: string };

export type LateMattersClient = { list(): Promise<LateMatter[]> };

export const lateMattersTool = "forms_catalog_raised_item_list_overdue";

const millisecondsPerDay = 24 * 60 * 60 * 1000;

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

const rowsOf = (reply: any): any[] => (Array.isArray(reply) ? reply : Array.isArray(reply?.items) ? reply.items : []);

const wholeDaysSince = (iso: string, now: Date) => {
  const elapsed = now.getTime() - new Date(iso).getTime();
  return Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / millisecondsPerDay)) : 0;
};

export const lateMatterOf = (raw: any, now: Date = new Date()): LateMatter => {
  const raisedAt = text(raw?.created_at);
  return {
    id: text(raw?.id),
    title: text(raw?.title),
    place: text(raw?.address) || text(raw?.street) || text(raw?.area),
    raisedAt,
    daysLate: wholeDaysSince(raisedAt, now),
    owner: text(raw?.department),
  };
};

export const longestLateFirst = (matters: LateMatter[]) => [...matters].sort((a, b) => b.daysLate - a.daysLate);

export const mcpLateMattersClient: LateMattersClient = {
  async list() {
    const reply = await callTool("", lateMattersTool, {});
    const now = new Date();
    return rowsOf(reply).map((row) => lateMatterOf(row, now));
  },
};

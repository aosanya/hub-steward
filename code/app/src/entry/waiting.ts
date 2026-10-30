import { callTool } from "../wakala/mcp";
import type { Words } from "./words";

export const formsWaiting = (count: number, words: Words) =>
  (count === 1 ? words.formsWaitingOne : words.formsWaitingMany).replace("{count}", String(count));

export type WaitingCount = (agencyId: string) => Promise<number>;

const readWaitingCount: WaitingCount = async (agencyId) => {
  const out = await callTool<{ items?: unknown[] }>(agencyId, "forms_form_list_waiting");
  return Array.isArray(out.items) ? out.items.length : 0;
};

let current: WaitingCount = readWaitingCount;

export const waitingCount: WaitingCount = (agencyId) => current(agencyId);

export const provideWaitingCount = (count: WaitingCount) => {
  current = count;
};

export const restoreWaitingCount = () => {
  current = readWaitingCount;
};

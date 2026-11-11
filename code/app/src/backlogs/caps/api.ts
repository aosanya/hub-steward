import { callTool } from "../../wakala/mcp";
import { itemsOf } from "../api";
import type { CapKey } from "./capsFigures";

export const capsTools = {
  read: "taskmanager_task_caps_read",
  set: "taskmanager_task_caps_set",
  clear: "taskmanager_task_caps_clear",
  nearest: "taskmanager_task_caps_nearest",
};

export type Caps = { input: number; output: number; runtimeSeconds: number };

export type CapsUsed = { input: number; output: number; seconds: number; clockStopped: boolean; updatedAt?: string };

export type CapsReading = { inForce: Caps; standard: Caps; own: Caps | null; used: CapsUsed | null };

export type CapNearest = { key: CapKey; used: number; cap: number; ratio: number };

export type CapsChange = Partial<Caps>;

export type CapsClient = {
  read: (issueId: string) => Promise<CapsReading>;
  nearest: (issueIds: string[]) => Promise<Record<string, CapNearest>>;
  set: (issueId: string, change: CapsChange) => Promise<CapsReading>;
  clear: (issueId: string) => Promise<CapsReading>;
};

const whole = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);

const capsOf = (raw: any): Caps => ({ input: whole(raw?.input_tokens), output: whole(raw?.output_tokens), runtimeSeconds: whole(raw?.runtime_seconds) });

const anyCap = (caps: Caps) => caps.input > 0 || caps.output > 0 || caps.runtimeSeconds > 0;

const usedOf = (raw: any): CapsUsed | null =>
  raw && typeof raw === "object"
    ? {
        input: Math.max(0, Number(raw.input_tokens) || 0),
        output: Math.max(0, Number(raw.output_tokens) || 0),
        seconds: Math.max(0, Number(raw.seconds_used) || 0),
        clockStopped: raw.clock_stopped === true,
        updatedAt: typeof raw.updated_at === "string" && raw.updated_at !== "" ? raw.updated_at : undefined,
      }
    : null;

export const readingOf = (raw: any): CapsReading => {
  const inForce = capsOf(raw?.in_force);
  if (!anyCap(inForce)) throw new Error("the hub sent no caps");
  const own = capsOf(raw?.own);
  return { inForce, standard: capsOf(raw?.default), own: anyCap(own) ? own : null, used: usedOf(raw?.used) };
};

const nearestKeys: Record<string, CapKey> = { input_tokens: "input", output_tokens: "output", runtime_seconds: "runtimeSeconds" };

export const nearestOf = (reply: unknown): Record<string, CapNearest> => {
  const found: Record<string, CapNearest> = {};
  for (const item of itemsOf(reply)) {
    const key = nearestKeys[item?.nearest?.key];
    const ratio = Number(item?.nearest?.ratio);
    if (typeof item?.task_id !== "string" || !key || !Number.isFinite(ratio) || ratio < 0) continue;
    found[item.task_id] = { key, used: Number(item.nearest.used) || 0, cap: Number(item.nearest.cap) || 0, ratio };
  }
  return found;
};

const bodyOf = (change: CapsChange) => ({
  ...(change.input ? { input_tokens: change.input } : {}),
  ...(change.output ? { output_tokens: change.output } : {}),
  ...(change.runtimeSeconds ? { runtime_seconds: change.runtimeSeconds } : {}),
});

export const mcpCapsClient: CapsClient = {
  async read(issueId) {
    return readingOf(await callTool("", capsTools.read, { taskID: issueId }));
  },
  async nearest(issueIds) {
    return nearestOf(await callTool("", capsTools.nearest, { task_id: issueIds }));
  },
  async set(issueId, change) {
    return readingOf(await callTool("", capsTools.set, { taskID: issueId, ...bodyOf(change) }));
  },
  async clear(issueId) {
    return readingOf(await callTool("", capsTools.clear, { taskID: issueId }));
  },
};

import { callTool } from "../../wakala/mcp";

export const capsTools = {
  read: "taskmanager_task_caps_read",
  set: "taskmanager_task_caps_set",
  clear: "taskmanager_task_caps_clear",
};

export type Caps = { input: number; output: number; runtimeSeconds: number };

export type CapsUsed = { input: number; output: number; seconds: number; clockStopped: boolean };

export type CapsReading = { inForce: Caps; standard: Caps; own: Caps | null; used: CapsUsed | null };

export type CapsChange = Partial<Caps>;

export type CapsClient = {
  read: (issueId: string) => Promise<CapsReading>;
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
      }
    : null;

export const readingOf = (raw: any): CapsReading => {
  const inForce = capsOf(raw?.in_force);
  if (!anyCap(inForce)) throw new Error("the hub sent no caps");
  const own = capsOf(raw?.own);
  return { inForce, standard: capsOf(raw?.default), own: anyCap(own) ? own : null, used: usedOf(raw?.used) };
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
  async set(issueId, change) {
    return readingOf(await callTool("", capsTools.set, { taskID: issueId, ...bodyOf(change) }));
  },
  async clear(issueId) {
    return readingOf(await callTool("", capsTools.clear, { taskID: issueId }));
  },
};

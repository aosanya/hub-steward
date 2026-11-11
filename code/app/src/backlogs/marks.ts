export const markNames = ["Ready", "Waiting", "Blocked"] as const;

export type Mark = (typeof markNames)[number] | "";

export const markPrecedence: Mark[] = ["Blocked", "Waiting", "Ready"];

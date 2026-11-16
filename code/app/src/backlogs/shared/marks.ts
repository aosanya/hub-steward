export const markNames = ["Ready", "Waiting", "Sinbin", "Blocked"] as const;

export type Mark = (typeof markNames)[number] | "";

export const markPrecedence: Mark[] = ["Blocked", "Sinbin", "Waiting", "Ready"];

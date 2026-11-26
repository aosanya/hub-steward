import type { Hub } from "../types";

export type HubKind = "lab" | "farmers" | "riders";

export type HubState = "ready" | "setup";

export const hubKinds: HubKind[] = ["lab", "farmers", "riders"];

export const defaultKind: HubKind = "lab";

const mentions = (text: string, words: string[]) => words.some((word) => text.includes(word));

export function namedKindOf(hub: Pick<Hub, "kind">): HubKind | null {
  const kind = (hub.kind ?? "").toLowerCase();
  if (mentions(kind, ["farm"])) return "farmers";
  if (mentions(kind, ["rider", "boda"])) return "riders";
  return /\blab\b/.test(kind) ? "lab" : null;
}

export const kindOf = (hub: Pick<Hub, "kind">): HubKind => namedKindOf(hub) ?? defaultKind;

export const stateOf = (hub: Pick<Hub, "model_key_set">): HubState => (hub.model_key_set === true ? "ready" : "setup");

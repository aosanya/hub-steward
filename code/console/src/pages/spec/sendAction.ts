import { pageModule } from "../../data/registry";
import type { ActionResult } from "../../data/types";

let lastFailure = "";

export const failureOf = (): string => lastFailure;

export type Outcome = ActionResult | "failed";

export async function sendAction(
  page: string,
  action: string,
  hubId: string,
  values: Record<string, unknown>,
): Promise<Outcome> {
  const run = pageModule(page)?.actions?.[action];
  if (!run) return "failed";
  lastFailure = "";
  try {
    return await run(hubId, values);
  } catch (error) {
    lastFailure = error instanceof Error ? error.message : "";
    return "failed";
  }
}

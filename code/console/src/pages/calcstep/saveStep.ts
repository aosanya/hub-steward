import { callTool } from "../../wakala/mcp";
import type { StepRef } from "./failureChoice";
import type { Posting } from "./postingSentence";
import type { InputRow, Source } from "./sourceFlags";
import type { StepCardValue } from "./StepCard";

export type StepDraft = {
  stepId: string;
  function: string;
  inputs: InputRow[];
  steps: StepRef[];
  step: StepCardValue;
  postStepId: string;
  posting: Posting;
};

export type Call = typeof callTool;

const idOfStep = (steps: StepRef[], name: string) => steps.find((step) => step.name === name)?.id ?? name;

const bindingOf = (row: InputRow, steps: StepRef[]) => {
  const source: Source | null = row.source;
  if (source === null) return null;
  if (source.kind === "step") return { input: row.name, source_type: "answer", step_id: idOfStep(steps, source.step), question: source.question };
  if (source.kind === "record") return { input: row.name, source_type: "record_field", record_id: source.record, question: source.question };
  if (source.kind === "ledger") return { input: row.name, source_type: "ledger_balance" };
  return { input: row.name, source_type: "fixed", value: source.value };
};

const failureOf = (failure: StepCardValue["failure"]) => {
  if (failure === null) return null;
  return failure.kind === "stop" ? { choice: "stop" } : { choice: "go_to_step", step_id: failure.stepId };
};

export const calculatingFields = (draft: StepDraft) => {
  const bindings = draft.inputs.flatMap((row) => bindingOf(row, draft.steps) ?? []);
  const onFailure = failureOf(draft.step.failure);
  return {
    work_item_id: draft.stepId,
    function: draft.function,
    bindings: JSON.stringify(bindings),
    result_name: draft.step.resultName,
    ...(onFailure ? { on_failure: JSON.stringify(onFailure) } : {}),
  };
};

export const postingFields = (draft: StepDraft) => ({
  work_item_id: draft.postStepId,
  amount_step_id: draft.posting.amount,
  debit_account: draft.posting.debitAccount,
  credit_account: draft.posting.creditAccount,
  reason: draft.posting.reason,
});

const postingIsComplete = ({ posting }: StepDraft) => Boolean(posting.amount && posting.debitAccount && posting.creditAccount && posting.reason.trim());

async function openDraftId(hubId: string, call: Call): Promise<string> {
  const answer = (await call(hubId, "agency_list_drafts", {})) as { items?: { id?: string }[] };
  return answer.items?.[0]?.id ?? "";
}

export async function saveStep(hubId: string, draft: StepDraft, call: Call = callTool): Promise<void> {
  const draftId = await openDraftId(hubId, call);
  const withDraft = <T extends object>(fields: T) => (draftId ? { ...fields, draft_id: draftId } : fields);
  await call(hubId, "agency_update_work_item", withDraft(calculatingFields(draft)));
  if (postingIsComplete(draft) && draft.postStepId) await call(hubId, "agency_update_work_item", withDraft(postingFields(draft)));
}

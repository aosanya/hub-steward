import { listPublished, loadDraft, publishDraft, type DraftChange, type DraftProblem, type PublishOutcome, type PublishedVersion } from "../../data/draft";
import { loadGenerated, slotsOf, type GeneratedSet, type RecordSlot } from "../../data/pages/generatedWorkflows";
import { loadScenarios, type Scenario } from "../../data/scenario";
import type { PageRow } from "../../types";
import { recordPath } from "../workflows/GeneratedWorkflowsPage";

export type PublishState = { draftId: string; changes: DraftChange[]; notPassed: Scenario[]; published: PublishedVersion[]; generated: GeneratedSet | null };

export type NotReadyWord = "publish.offNoDraft" | "publish.offNoChanges";

export const isReady = (state: PublishState): boolean =>
  state.draftId !== "" && (state.changes.length > 0 || state.published.length === 0);

export const whyNotReady = (state: PublishState): NotReadyWord | null => {
  if (isReady(state)) return null;
  return state.draftId === "" ? "publish.offNoDraft" : "publish.offNoChanges";
};

export const latestVersion = (state: PublishState): number => Math.max(0, ...state.published.map((one) => one.version));

export const loadPublishState = async (hubId: string): Promise<PublishState> => {
  const [snapshot, scenarios, published, generated] = await Promise.all([
    loadDraft(hubId),
    loadScenarios(hubId),
    listPublished(hubId),
    loadGenerated(hubId).catch(() => null),
  ]);
  return {
    draftId: snapshot.draft?.id ?? "",
    changes: snapshot.changes,
    notPassed: scenarios.filter((scenario) => scenario.result !== "passed"),
    published,
    generated,
  };
};

export const slotsFor = (state: PublishState): RecordSlot[][] => (state.generated ? state.generated.records.map((record) => slotsOf(state.generated!, record)) : []);

export const missingSlots = (state: PublishState): RecordSlot[] => slotsFor(state).flat().filter((slot) => slot.workflow === null);

const missingProblem = (hubId: string, slot: RecordSlot): DraftProblem => ({
  message: "",
  word: "publish.generatedMissing",
  values: { record: slot.record.name, code: slot.record.code, workflow: slot.code },
  to: recordPath(hubId, slot.record.code),
  open: "generated.openRecord",
});

export const publishNow = async (hubId: string): Promise<PublishOutcome> => {
  const state = await loadPublishState(hubId);
  if (!isReady(state)) throw new Error("the draft is not ready to publish");
  const missing = missingSlots(state);
  if (missing.length > 0) return { problems: missing.map((slot) => missingProblem(hubId, slot)) };
  return publishDraft(hubId, state.draftId);
};

export const notPassedRows = async (hubId: string): Promise<PageRow[]> =>
  (await loadPublishState(hubId)).notPassed.map((scenario) => ({ id: scenario.id, name: scenario.name, result: scenario.result }));

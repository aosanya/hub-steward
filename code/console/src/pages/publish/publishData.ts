import { listPublished, loadDraft, publishDraft, type DraftChange, type PublishOutcome, type PublishedVersion } from "../../data/draft";
import { loadScenarios, type Scenario } from "../../data/scenario";
import type { PageRow } from "../../types";

export type PublishState = { draftId: string; changes: DraftChange[]; notPassed: Scenario[]; published: PublishedVersion[] };

export const isReady = (state: PublishState): boolean => state.draftId !== "" && state.changes.length > 0;

export const loadPublishState = async (hubId: string): Promise<PublishState> => {
  const [snapshot, scenarios, published] = await Promise.all([loadDraft(hubId), loadScenarios(hubId), listPublished(hubId)]);
  return {
    draftId: snapshot.draft?.id ?? "",
    changes: snapshot.changes,
    notPassed: scenarios.filter((scenario) => scenario.result !== "passed"),
    published,
  };
};

export const publishNow = async (hubId: string): Promise<PublishOutcome> => {
  const state = await loadPublishState(hubId);
  if (!isReady(state)) throw new Error("the draft is not ready to publish");
  return publishDraft(hubId, state.draftId);
};

export const notPassedRows = async (hubId: string): Promise<PageRow[]> =>
  (await loadPublishState(hubId)).notPassed.map((scenario) => ({ id: scenario.id, name: scenario.name, result: scenario.result }));

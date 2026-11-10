import { hubPath } from "../api";
import { callTool } from "../wakala/mcp";
import type { Query } from "./types";

type Item = Record<string, unknown>;

export type DraftState =
  | "none"
  | "pending"
  | "publishing"
  | "failed"
  | "published";

export type OpenDraft = { id: string; description: string };

export type Published = { version: number; tag: string; at: string };

export type PublishedVersion = Published & { channel: string };

export type ChangeKindWord =
  | "draft.kindGoal"
  | "draft.kindObjective"
  | "draft.kindRole"
  | "draft.kindProfile";

export type DraftChange = {
  id: string;
  summary: string;
  title: string;
  kindWord: ChangeKindWord;
  page: string;
  decidedBy: string;
  at: string;
};

export type ProblemWord = "draft.noChanges" | "draft.publishFailed";

export type OpenWord =
  | "draft.openGoal"
  | "draft.openObjective"
  | "draft.openRole"
  | "draft.openProfile"
  | "test.openWorkflow";

export type DraftProblem = {
  message: string;
  to?: string;
  open?: OpenWord;
  word?: ProblemWord;
};

export type DraftSnapshot = {
  draft: OpenDraft | null;
  changes: DraftChange[];
  last: Published | null;
};

export type PublishOutcome =
  | { published: Published }
  | { problems: DraftProblem[] };

export const draftPages = ["profile", "goals", "roles", "risks", "bowties", "modules", "assistant"];

export const showsDraftBar = (page: string) => draftPages.includes(page);

const changeKinds: Record<string, { page: string; word: ChangeKindWord }> = {
  agency_create_goal: { page: "goals", word: "draft.kindGoal" },
  agency_create_objective: { page: "goals", word: "draft.kindObjective" },
  agency_create_role: { page: "roles", word: "draft.kindRole" },
  agency_update_role: { page: "roles", word: "draft.kindRole" },
  agency_update_agency: { page: "profile", word: "draft.kindProfile" },
};

export const changePageOf = (kind: string): string | undefined =>
  Object.hasOwn(changeKinds, kind) ? changeKinds[kind].page : undefined;

export const changesPath = (hubId: string) =>
  `${hubPath(hubId, "goals")}?changes=1`;

const productionChannel = "production";

const refusedMarker = "cannot be published:";

const noChangesMarker = "no changes detected";

const isRecord = (value: unknown): value is Item =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" ? value : "");

const itemsOf = (answer: unknown): Item[] => {
  const list = Array.isArray(answer)
    ? answer
    : isRecord(answer) && Array.isArray(answer.items)
      ? answer.items
      : [];
  return list.filter(isRecord);
};

const moment = (iso: string) => Date.parse(iso);

export const isUnpublished = (decidedAt: string, last: Published | null) => {
  if (last === null) return true;
  const decided = moment(decidedAt);
  const published = moment(last.at);
  return (
    Number.isNaN(decided) || Number.isNaN(published) || decided > published
  );
};

const publishedOf = (item: Item): Published => {
  const version = Number(item.version);
  return {
    version: Number.isFinite(version) ? version : 0,
    tag: text(item.tag),
    at: text(item.published_at),
  };
};

const latestPublication = (answer: unknown): Published | null => {
  const all = itemsOf(answer).map(publishedOf);
  return all.reduce<Published | null>(
    (latest, one) =>
      latest === null || one.version > latest.version ? one : latest,
    null,
  );
};

export async function listPublished(hubId: string): Promise<PublishedVersion[]> {
  return itemsOf(await callTool<unknown>(hubId, "agency_list_publications"))
    .map((item) => ({ ...publishedOf(item), channel: text(item.channel) }))
    .sort((a, b) => b.version - a.version);
}

export type PublicationDocument = Published & { channel: string; document: Record<string, unknown> };

export async function getPublication(hubId: string, version: number): Promise<PublicationDocument> {
  const answer = await callTool<Record<string, unknown>>(hubId, "agency_get_publication", { version });
  const document = answer.document;
  return {
    ...publishedOf(answer as Item),
    channel: text((answer as Item).channel),
    document: document !== null && typeof document === "object" && !Array.isArray(document) ? (document as Record<string, unknown>) : {},
  };
}

export async function lastPublished(hubId: string): Promise<Published | null> {
  return latestPublication(
    await callTool<unknown>(hubId, "agency_list_publications"),
  );
}

const workingDraftOf = (answer: unknown): OpenDraft | null => {
  const newest = itemsOf(answer)
    .filter((draft) => text(draft.id) !== "" && text(draft.status) === "open")
    .at(-1);
  return newest
    ? { id: text(newest.id), description: text(newest.description) }
    : null;
};

const openDraftsOf = (hubId: string) =>
  callTool<unknown>(hubId, "agency_list_drafts", { status: "open" });

export async function workingDraftId(hubId: string): Promise<string> {
  return workingDraftOf(await openDraftsOf(hubId))?.id ?? "";
}

export type DraftScope = { draft_id?: string };

export async function draftScope(
  hubId: string,
  query: Query = {},
): Promise<DraftScope> {
  const draftId =
    typeof query.draft_id === "string"
      ? query.draft_id
      : await workingDraftId(hubId);
  return draftId === "" ? {} : { draft_id: draftId };
}

const payloadOf = (raw: unknown): Item => {
  let value: unknown = raw;
  for (let layer = 0; layer < 2 && typeof value === "string"; layer++) {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return isRecord(value) ? value : {};
};

const changeOf = (approval: Item): DraftChange => {
  const kind = changeKinds[text(approval.kind)];
  const payload = payloadOf(approval.payload);
  const summary = text(approval.summary);
  return {
    id: text(approval.id),
    summary,
    title: text(payload.title).trim() || text(payload.name).trim() || summary,
    kindWord: kind.word,
    page: kind.page,
    decidedBy: text(approval.decided_by),
    at: text(approval.decided_at),
  };
};

export async function loadDraft(hubId: string): Promise<DraftSnapshot> {
  const [drafts, approvals, publications] = await Promise.all([
    openDraftsOf(hubId),
    callTool<unknown>(hubId, "agency_list_approvals", { status: "approved" }),
    callTool<unknown>(hubId, "agency_list_publications"),
  ]);
  const draft = workingDraftOf(drafts);
  const last = latestPublication(publications);
  const changes =
    draft === null
      ? []
      : itemsOf(approvals)
          .filter(
            (approval) =>
              changePageOf(text(approval.kind)) !== undefined &&
              isUnpublished(text(approval.decided_at), last),
          )
          .map(changeOf);
  return { draft, changes, last };
}

const entityPages: Record<string, string> = {
  goal: "goals",
  objective: "goals",
  role: "roles",
  workflow: "workflows",
  agency: "profile",
};

const entityParams: Record<string, string> = {
  goal: "goal",
  objective: "objective",
  role: "open",
  workflow: "open",
};

const entityOpens: Record<string, OpenWord> = {
  goal: "draft.openGoal",
  objective: "draft.openObjective",
  role: "draft.openRole",
  workflow: "test.openWorkflow",
  agency: "draft.openProfile",
};

export const problemLink = (
  hubId: string,
  entityType: string,
  entityId: string,
): string | undefined => {
  if (!Object.hasOwn(entityPages, entityType)) return undefined;
  const path = hubPath(hubId, entityPages[entityType]);
  if (entityId === "" || !Object.hasOwn(entityParams, entityType)) return path;
  return `${path}?${entityParams[entityType]}=${encodeURIComponent(entityId)}`;
};

const problemOf = (
  hubId: string,
  message: string,
  entityType: string,
  entityId: string,
): DraftProblem => {
  const to = problemLink(hubId, entityType, entityId);
  return to === undefined
    ? { message }
    : { message, to, open: entityOpens[entityType] };
};

export async function scanDraft(
  hubId: string,
  draftId: string,
): Promise<DraftProblem[]> {
  const issues = itemsOf(
    await callTool<unknown>(hubId, "agency_list_issues", { draft_id: draftId }),
  );
  return issues
    .filter((issue) => text(issue.severity) === "error")
    .map((issue) =>
      problemOf(
        hubId,
        text(issue.message),
        text(issue.entity_type),
        text(issue.entity_id),
      ),
    );
}

const refusalProblems = (error: unknown): DraftProblem[] => {
  const said = error instanceof Error ? error.message : String(error);
  const marked = said.indexOf(refusedMarker);
  if (marked >= 0) {
    const sentences = said
      .slice(marked + refusedMarker.length)
      .split(";")
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence !== "");
    if (sentences.length > 0) return sentences.map((message) => ({ message }));
  }
  if (said.toLowerCase().includes(noChangesMarker))
    return [{ message: "", word: "draft.noChanges" }];
  return [{ message: "", word: "draft.publishFailed" }];
};

export async function publishDraft(
  hubId: string,
  draftId: string,
): Promise<PublishOutcome> {
  try {
    const blocking = await scanDraft(hubId, draftId);
    if (blocking.length > 0) return { problems: blocking };
    const frozen = await callTool<unknown>(hubId, "agency_publish_agency", {
      draft_id: draftId,
      channel: productionChannel,
    });
    return { published: publishedOf(isRecord(frozen) ? frozen : {}) };
  } catch (error) {
    return { problems: refusalProblems(error) };
  }
}

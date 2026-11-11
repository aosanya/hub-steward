import type { PageRow } from "../../types";
import { McpError, callTool } from "../../wakala/mcp";
import type { ActionRun, PageModule, Query } from "../types";
import { roleItems, text, type Item } from "./agents";

export type ApprovalFailure = { id: string; error: string };

export type ApprovalsDecided = { decided: string[]; failed: ApprovalFailure[] };

const approvalStates = new Map([
  ["pending", "pending"],
  ["approved", "approved"],
  ["declined", "refused"],
]);

const approvalDecisions = new Set(["approved", "refused"]);

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const isRequester = (row: PageRow, requester: string) => {
  const facts = approvalFacts(row);
  return row.proposed_by === requester || (facts.named && sameName(facts.who, requester));
};

const listApprovals = async (hubId: string, query: Query): Promise<PageRow[]> => {
  const args: Record<string, unknown> = {};
  if (query.state) {
    const status = approvalStates.get(query.state);
    if (status === undefined) return [];
    args.status = status;
  }
  const items = roleItems(await callTool(hubId, "agency_list_approvals", args));
  return items.filter((item) => !query.requester || isRequester(item, query.requester));
};

const decideApproval = async (hubId: string, id: string, decision: string, reason: string, seenAmendments?: number) => {
  const args: Record<string, unknown> = { approval_id: id, decision };
  if (reason !== "") args.reason = reason;
  if (seenAmendments !== undefined) args.seen_amendments = seenAmendments;
  await callTool(hubId, "agency_decide_approval", args);
};

export const amendmentsSeen = (row: PageRow): number | undefined => (row.amendments === undefined ? undefined : listIn(row, "amendments").length);

export const isChangedSinceRead = (error: unknown) => error instanceof McpError && error.message.includes("changed after it was read");

const failureText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const decideAllPending = async (
  hubId: string,
  requester: string,
  decision: string,
  reason: string,
): Promise<ApprovalsDecided> => {
  const out: ApprovalsDecided = { decided: [], failed: [] };
  const rows = await listApprovals(hubId, { state: "pending", requester });
  for (const row of rows) {
    const id = text(row.id);
    if (id === "") continue;
    try {
      await decideApproval(hubId, id, decision, reason, amendmentsSeen(row));
      out.decided.push(id);
    } catch (error) {
      out.failed.push({ id, error: failureText(error) });
    }
  }
  return out;
};

const decide: ActionRun = async (hubId, values) => {
  const decision = text(values.decision);
  if (!approvalDecisions.has(decision)) throw new Error("that was not understood");
  const reason = text(values.reason);
  const id = text(values.id);
  if (id.trim() !== "") {
    const seen = typeof values.seen_amendments === "number" ? values.seen_amendments : undefined;
    await decideApproval(hubId, id, decision, reason, seen);
    return "done";
  }
  const requester = text(values.requester);
  if (requester.trim() === "") throw new Error("id or requester is required");
  await decideAllPending(hubId, requester, decision, reason);
  return "done";
};

export type ApprovalFacts = {
  who: string;
  named: boolean;
  proposer: string;
  language: string;
  kind: string;
  proposedAt: string;
  decidedBy: string;
  decidedAt: string;
  reason: string;
};

const payloadOf = (row: PageRow): Item => {
  const raw = text(row.payload);
  if (raw === "") return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Item) : {};
  } catch {
    return {};
  }
};

const spoken = (language: string) => (["", "en", "english"].includes(language.trim().toLowerCase()) ? "" : language.trim());

export const approvalKindLabel = (kind: string) => {
  const words = kind.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const approvalFacts = (row: PageRow): ApprovalFacts => {
  const payload = payloadOf(row);
  const proposer = text(row.proposed_by);
  const member = text(payload.name).trim();
  return {
    who: member || proposer,
    named: member !== "",
    proposer,
    language: spoken(text(payload.language)),
    kind: approvalKindLabel(text(row.kind)),
    proposedAt: text(row.proposed_at),
    decidedBy: text(row.decided_by),
    decidedAt: text(row.decided_at),
    reason: text(row.reason),
  };
};

export type ApprovalStep = "drafted" | "amended" | "approved" | "declined" | "taken";

export type ApprovalLogEntry = { at: string; by: string; step: ApprovalStep; tool: string; said: string };

const stepTools: Record<ApprovalStep, string> = {
  drafted: "agency_propose_write",
  amended: "agency_amend_approval",
  approved: "agency_decide_approval",
  declined: "agency_decide_approval",
  taken: "",
};

const listIn = (row: PageRow, key: string): Item[] => {
  const raw = text(row[key]);
  if (raw === "") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is Item => typeof entry === "object" && entry !== null && !Array.isArray(entry)) : [];
  } catch {
    return [];
  }
};

export const approvalLog = (row: PageRow): ApprovalLogEntry[] => {
  const entry = (at: string, by: string, step: ApprovalStep, said = ""): ApprovalLogEntry => ({ at, by, step, said, tool: stepTools[step] });
  const decision: ApprovalLogEntry[] =
    text(row.decided_at) === "" && text(row.decided_by) === ""
      ? []
      : [entry(text(row.decided_at), text(row.decided_by), text(row.status) === "refused" ? "declined" : "approved")];
  return [
    entry(text(row.proposed_at), text(row.proposed_by), "drafted"),
    ...listIn(row, "amendments").map((amendment) => entry(text(amendment.at), text(amendment.by), "amended")),
    ...decision,
    ...listIn(row, "applied")
      .filter((taken) => text(taken.step).trim() !== "")
      .map((taken) => entry(text(taken.at), text(taken.by), "taken", text(taken.step))),
  ];
};

export const approvalsPage: PageModule = {
  spec: {
    id: "approvals",
    title: "Approvals",
    primary: "",
    tools: ["agency_list_approvals", "agency_decide_approval"],
    columns: [
      { key: "summary", label: "Request" },
      { key: "kind", label: "Kind" },
      { key: "proposed_by", label: "Asked by" },
      { key: "proposed_at", label: "Asked" },
      { key: "status", label: "State" },
    ],
  },
  rows: listApprovals,
  actions: { decide },
};

import { callTool } from "../../shared/wakala/mcp";
import { resolveMember } from "../market";
export type Risk = { id: string; title: string; topEvent: string; status: string; owner: string };

export type RiskAction = { id: string; riskId: string; title: string; status: string; dueAt: string; owner: string };

export type Rating = { kind: string; score: number; band: string };

export type Side = "threat" | "consequence";

export type Safeguard = {
  barrierId: string;
  side: Side;
  pathway: string;
  control: string;
  standing: string;
  evidenceCount: number;
  latestOutcome: string;
};

export type RiskDetail = { risk: Risk; ratings: Rating[]; safeguards: Safeguard[]; actions: RiskAction[] };

export type Gap = { kind: string; severity: string; riskId: string; subject: string; subjectId: string; message: string };

export type EvidenceDraft = { barrierId: string; kind: string; outcome: string; summary: string; reference: string };

export type RisksClient = {
  myRisks(): Promise<Risk[]>;
  myActions(): Promise<RiskAction[]>;
  myGaps(): Promise<Gap[]>;
  risk(riskId: string): Promise<RiskDetail>;
  recordEvidence(draft: EvidenceDraft): Promise<void>;
};

export const evidenceKinds = ["test", "log", "audit", "configuration", "incident"];

export const evidenceOutcomes = ["pass", "partial", "fail"];

export const riskTools = {
  risks: "riskmanager_risk_list",
  actions: "riskmanager_action_list",
  bowtie: "riskmanager_risk_bowtie",
  preventive: "riskmanager_preventive_measure_list",
  mitigating: "riskmanager_mitigating_measure_list",
  evidence: "riskmanager_evidence_record",
  gaps: "riskmanager_gap_list",
};

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

const rowsOf = (reply: any): any[] => (Array.isArray(reply) ? reply : Array.isArray(reply?.items) ? reply.items : []);

export const riskOf = (raw: any): Risk => ({
  id: text(raw?.id),
  title: text(raw?.title),
  topEvent: text(raw?.top_event),
  status: text(raw?.status),
  owner: text(raw?.owner),
});

export const actionOf = (raw: any): RiskAction => ({
  id: text(raw?.id),
  riskId: text(raw?.risk_id),
  title: text(raw?.title),
  status: text(raw?.status),
  dueAt: text(raw?.due_at),
  owner: text(raw?.owner),
});

export const gapOf = (raw: any): Gap => ({
  kind: text(raw?.kind),
  severity: text(raw?.severity),
  riskId: text(raw?.risk_id),
  subject: text(raw?.subject),
  subjectId: text(raw?.subject_id),
  message: text(raw?.message),
});

const ratingOf = (kind: string, raw: any): Rating[] =>
  raw ? [{ kind, score: Number(raw.score) || 0, band: text(raw.band) }] : [];

export const safeguardOf = (raw: any): Safeguard => ({
  barrierId: text(raw?.barrier?.id),
  side: raw?.pathway?.side === "consequence" ? "consequence" : "threat",
  pathway: text(raw?.pathway?.title),
  control: text(raw?.control?.name),
  standing: text(raw?.standing),
  evidenceCount: Number(raw?.evidence_count) || 0,
  latestOutcome: text(raw?.latest_evidence?.outcome),
});

const ownedBy = (member: string) => (row: { owner: string }) => member !== "" && row.owner === member;

export const mcpRisksClient: RisksClient = {
  async myRisks() {
    const member = await resolveMember();
    if (member === "") return [];
    const reply = await callTool("", riskTools.risks, { owner: member });
    return rowsOf(reply).map(riskOf).filter(ownedBy(member));
  },
  async myActions() {
    const member = await resolveMember();
    if (member === "") return [];
    const reply = await callTool("", riskTools.actions, { owner: member });
    return rowsOf(reply).map(actionOf).filter(ownedBy(member));
  },
  async myGaps() {
    const member = await resolveMember();
    if (member === "") return [];
    const [risks, gaps] = await Promise.all([
      callTool("", riskTools.risks, { owner: member }),
      callTool("", riskTools.gaps, { owner: member }),
    ]);
    const ownRiskIds = new Set(rowsOf(risks).map(riskOf).filter(ownedBy(member)).map((risk) => risk.id));
    return rowsOf(gaps).map(gapOf).filter((gap) => ownRiskIds.has(gap.riskId));
  },
  async risk(riskId) {
    const member = await resolveMember();
    const [bowtie, preventive, mitigating] = await Promise.all([
      callTool("", riskTools.bowtie, { riskID: riskId }),
      callTool("", riskTools.preventive, { risk_id: riskId }),
      callTool("", riskTools.mitigating, { risk_id: riskId }),
    ]);
    const risk = riskOf(bowtie?.risk);
    if (!ownedBy(member)(risk)) throw new Error("not your risk");
    return {
      risk,
      ratings: [
        ...ratingOf("inherent", bowtie?.inherent),
        ...ratingOf("residual", bowtie?.residual),
        ...ratingOf("target", bowtie?.target),
      ],
      safeguards: [...rowsOf(preventive), ...rowsOf(mitigating)].map(safeguardOf),
      actions: rowsOf(bowtie?.actions).map(actionOf),
    };
  },
  async recordEvidence(draft) {
    await callTool("", riskTools.evidence, {
      barrier_id: draft.barrierId,
      kind: draft.kind,
      outcome: draft.outcome,
      summary: draft.summary,
      reference: draft.reference,
    });
  },
};

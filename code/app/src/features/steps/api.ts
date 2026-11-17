import { openAgencyId } from "../../shared/wakala/openAgency";
import { stepOf, type StartStep } from "../market/start/api";
import { runtimeConfig } from "../../shared/wakala/config";
import { callTool, forgetReads } from "../../shared/wakala/mcp";
import { renewedAuthHeaders } from "../../shared/wakala/renewal";
import { serverSentenceOf } from "./overLimitRefusal";
import { wasStarted } from "./sent";

export type StepState = "start" | "waiting";

export type EarlierStep = { stepTitle: string; roleName: string; answers: { prompt: string; answer: string }[] };

export type ApprovalLimit = { amount?: number };

export type MemberStep = StartStep & { state: StepState; orderId: string; recordCode: string; earlier: EarlierStep[]; approval?: boolean; approvalLimit?: ApprovalLimit };

export type Sent = { done: boolean; next: MemberStep | null; orderId: string };

export type SendRefusal = "role" | "not-ready" | "invalid" | "missing" | "failed" | "timeout" | "over-limit";

export const sendTimeoutMs = 20000;

export const newSendKey = () => crypto.randomUUID();

export const refusalWords: Record<SendRefusal, string> = {
  role: "This step is not for your role.",
  "not-ready": "This step is not ready or was already sent.",
  invalid: "Check your answers and try again.",
  missing: "This task could not be opened.",
  failed: "Your answers could not be sent. Try again.",
  timeout: "This is taking too long. Try again.",
  "over-limit": "This amount is above your approval limit.",
};

export class StepRefused extends Error {
  constructor(readonly reason: SendRefusal, message?: string) {
    super(message || refusalWords[reason]);
  }
}

export type AnotherSheet = { orderId: string };

export type StepsClient = {
  available: () => Promise<MemberStep[]>;
  submit: (step: Pick<MemberStep, "id" | "state" | "orderId">, answers: Record<string, string>, sendKey: string, another?: AnotherSheet) => Promise<Sent>;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

const stateOf = (raw: any): StepState | undefined => (raw?.state === "start" || raw?.state === "waiting" ? raw.state : undefined);

const earlierOf = (raw: any): EarlierStep[] =>
  (Array.isArray(raw?.earlier) ? raw.earlier : []).map((entry: any) => ({
    stepTitle: text(entry?.step_title),
    roleName: text(entry?.role_name),
    answers: (Array.isArray(entry?.answers) ? entry.answers : []).map((a: any) => ({ prompt: text(a?.prompt), answer: text(a?.answer) })),
  }));

const approvalLimitOf = (raw: any): ApprovalLimit | undefined => {
  const limit = raw?.approval_limit;
  if (typeof limit !== "object" || limit === null || Array.isArray(limit)) return undefined;
  return typeof limit.amount === "number" && Number.isFinite(limit.amount) ? { amount: limit.amount } : {};
};

export const memberStepOf = (raw: any): MemberStep | undefined => {
  const state = stateOf(raw);
  return state === undefined
    ? undefined
    : { ...stepOf("")(raw), state, orderId: text(raw?.order_id), recordCode: text(raw?.record_code), earlier: earlierOf(raw), approval: raw?.approval === true, ...(approvalLimitOf(raw) ? { approvalLimit: approvalLimitOf(raw) } : {}) };
};

const refusalOf = (status: number): SendRefusal =>
  status === 403 ? "role" : status === 400 ? "invalid" : status === 404 ? "missing" : status === 422 ? "over-limit" : "failed";

const answerKinds = ["fill_form", "send_form"];

const takesAnswers = (raw: any) => answerKinds.includes(raw?.kind) && Array.isArray(raw?.questions) && raw.questions.length > 0;

const sentStepIds = async (): Promise<Set<string>> => {
  const reply = await callTool("", "agency_list_my_sent_steps", { limit: 200 }).catch(() => undefined);
  const items: any[] = Array.isArray(reply?.items) ? reply.items : [];
  return new Set(items.flatMap((item) => (typeof item?.step_id === "string" ? [item.step_id] : [])));
};

export const mcpStepsClient: StepsClient = {
  async available() {
    const [reply, sent] = await Promise.all([callTool("", "agency_list_my_open_steps", { available: true }), sentStepIds()]);
    const items: any[] = Array.isArray(reply?.items) ? reply.items : [];
    return items
      .filter(takesAnswers)
      .flatMap((raw) => memberStepOf(raw) ?? [])
      .filter((step) => !(step.state === "start" && (wasStarted(step.id) || sent.has(step.id))));
  },
  async submit(step, answers, sendKey, another) {
    const { wakala } = await runtimeConfig();
    const body = another
      ? { answers, order_id: another.orderId, another_sheet: true, send_key: sendKey }
      : { answers, ...(step.state === "waiting" ? { order_id: step.orderId } : { send_key: sendKey }) };
    const limit = new AbortController();
    const timer = setTimeout(() => limit.abort(), sendTimeoutMs);
    let res: Response;
    try {
      res = await fetch(`${wakala}/instances/${encodeURIComponent(openAgencyId())}/steps/${encodeURIComponent(step.id)}/answers`, {
        method: "POST",
        credentials: "include",
        headers: { ...(await renewedAuthHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: limit.signal,
      });
    } catch {
      throw new StepRefused(limit.signal.aborted ? "timeout" : "failed");
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok && res.status !== 409) throw new StepRefused(refusalOf(res.status), res.status === 422 ? await serverSentenceOf(res) : undefined);
    forgetReads();
    if (res.status === 409) return { done: false, next: null, orderId: step.orderId };
    const reply = await res.json().catch(() => ({}));
    return { done: reply?.done === true, next: reply?.next_step ? (memberStepOf(reply.next_step) ?? null) : null, orderId: text(reply?.order_id) };
  },
};

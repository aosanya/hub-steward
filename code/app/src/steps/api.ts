import { openAgencyId } from "../agency/open";
import { stepOf, type StartStep } from "../coordinator/start/api";
import { runtimeConfig } from "../wakala/config";
import { callTool, forgetReads } from "../wakala/mcp";
import { renewedAuthHeaders } from "../wakala/renewal";
import { wasStarted } from "./sent";

export type StepState = "start" | "waiting";

export type MemberStep = StartStep & { state: StepState; orderId: string; recordCode: string };

export type Sent = { done: boolean; next: MemberStep | null; orderId: string };

export type SendRefusal = "role" | "not-ready" | "invalid" | "missing" | "failed";

export const refusalWords: Record<SendRefusal, string> = {
  role: "This step is not for your role.",
  "not-ready": "This step is not ready or was already sent.",
  invalid: "Check your answers and try again.",
  missing: "This could not be opened.",
  failed: "Your answers could not be sent. Try again.",
};

export class StepRefused extends Error {
  constructor(readonly reason: SendRefusal) {
    super(refusalWords[reason]);
  }
}

export type StepsClient = {
  available: () => Promise<MemberStep[]>;
  submit: (step: Pick<MemberStep, "id" | "state" | "orderId">, answers: Record<string, string>) => Promise<Sent>;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

const stateOf = (raw: any): StepState | undefined => (raw?.state === "start" || raw?.state === "waiting" ? raw.state : undefined);

export const memberStepOf = (raw: any): MemberStep | undefined => {
  const state = stateOf(raw);
  return state === undefined ? undefined : { ...stepOf("")(raw), state, orderId: text(raw?.order_id), recordCode: text(raw?.record_code) };
};

const refusalOf = (status: number): SendRefusal =>
  status === 403 ? "role" : status === 409 ? "not-ready" : status === 400 ? "invalid" : status === 404 ? "missing" : "failed";

const fillsForm = (raw: any) => raw?.kind === "fill_form" && Array.isArray(raw?.questions) && raw.questions.length > 0;

export const mcpStepsClient: StepsClient = {
  async available() {
    const reply = await callTool("", "agency_list_my_open_steps", { available: true });
    const items: any[] = Array.isArray(reply?.items) ? reply.items : [];
    return items
      .filter(fillsForm)
      .flatMap((raw) => memberStepOf(raw) ?? [])
      .filter((step) => !(step.state === "start" && wasStarted(step.id)));
  },
  async submit(step, answers) {
    const { wakala } = await runtimeConfig();
    const body = { answers, ...(step.state === "waiting" ? { order_id: step.orderId } : {}) };
    let res: Response;
    try {
      res = await fetch(`${wakala}/instances/${encodeURIComponent(openAgencyId())}/steps/${encodeURIComponent(step.id)}/answers`, {
        method: "POST",
        credentials: "include",
        headers: { ...(await renewedAuthHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new StepRefused("failed");
    }
    if (!res.ok) throw new StepRefused(refusalOf(res.status));
    forgetReads();
    const reply = await res.json().catch(() => ({}));
    return { done: reply?.done === true, next: reply?.next_step ? (memberStepOf(reply.next_step) ?? null) : null, orderId: text(reply?.order_id) };
  },
};

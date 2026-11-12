import { routes } from "../../routes";
import { callTool } from "../../wakala/mcp";

export type StartQuestion = { prompt: string; answerType: string; helper: string; required?: boolean; options?: string[] };

export type OpensIn = "chat" | "form";

export type StartStep = {
  id: string;
  title: string;
  formName: string;
  roleName: string;
  workflowName: string;
  agencyName: string;
  questions: StartQuestion[];
  opensIn?: OpensIn;
  orderId?: string;
};

export type StartDraft = { product: string; price: number; minimum: number; posterId: string };

export type Poster = { id: string; name: string };

export type PosterChoice = { kind: "one"; poster: Poster } | { kind: "several"; posters: Poster[] } | { kind: "none" };

export type StartClient = {
  waiting: () => Promise<StartStep[]>;
  openSteps: () => Promise<StartStep[]>;
  poster: () => Promise<PosterChoice>;
  start: (draft: StartDraft) => Promise<{ id: string }>;
};

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
const itemsOf = (reply: any): any[] => (Array.isArray(reply?.items) ? reply.items : []);

const opensInOf = (raw: any): OpensIn => (text(raw?.opens_in) === "chat" ? "chat" : "form");

export const stepOf = (agencyName: string) => (raw: any): StartStep => ({
  id: text(raw?.id),
  title: text(raw?.title),
  formName: text(raw?.form_name),
  roleName: text(raw?.role_name),
  workflowName: text(raw?.workflow_name),
  opensIn: opensInOf(raw),
  agencyName,
  questions: (Array.isArray(raw?.questions) ? raw.questions : []).map((q: any) => ({
    prompt: text(q?.prompt),
    answerType: text(q?.answer_type),
    helper: text(q?.helper),
    ...(q?.required === true ? { required: true } : {}),
    ...(Array.isArray(q?.options) && q.options.length > 0 ? { options: q.options.map(text) } : {}),
  })),
});

const fillsForm = (raw: any) => text(raw?.kind) === "fill_form" && Array.isArray(raw?.questions) && raw.questions.length > 0;

const isChatStep = (raw: any) => text(raw?.kind) === "chat" && opensInOf(raw) === "chat";

const groupOrderAnswerTypes = ["free_text", "currency", "number"];

export const groupOrderFormName = "Create group order";

export const isGroupOrderForm = (step: Pick<StartStep, "formName">) => step.formName === groupOrderFormName;

export const isGroupOrderStart = (step: StartStep) => groupOrderAnswerTypes.every((type) => step.questions.some((q) => q.answerType === type));

export type Unit = { unitBefore?: string; unitAfter?: string };

export const unitOf = (answerType: string): Unit => {
  if (answerType === "currency") return { unitBefore: "KES" };
  if (answerType === "number") return { unitAfter: "bags" };
  return {};
};

export const startPath = (id: string) => routes.start.path({ stepId: id });

export const waitingPath = (step: Pick<StartStep, "id" | "orderId">) =>
  step.orderId ? routes.step.path({ stepId: step.id }, { order: step.orderId }) : startPath(step.id);

export const coordinatorOrderPath = (id: string) => `/coordinator/orders/${id}`;

const numberOf = (value: string) => {
  const n = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
};

export const draftOf = (questions: StartQuestion[], answers: string[]): Omit<StartDraft, "posterId"> => {
  const pick = (type: string) => answers[questions.findIndex((q) => q.answerType === type)] ?? "";
  return { product: pick("free_text").trim(), price: numberOf(pick("currency")), minimum: numberOf(pick("number")) };
};

export const isLiveBuyOrder = (raw: any) => text(raw?.direction) === "buy" && (text(raw?.state) === "open" || text(raw?.state) === "revising");

const posterOf = (raw: any): Poster => ({ id: text(raw?.id), name: text(raw?.name) });

const readOpenSteps = () => callTool("", "agency_list_my_open_steps", {});

const readAvailableSteps = () => callTool("", "agency_list_my_open_steps", { available: true });

const waitsOnMember = (raw: any) => text(raw?.state) === "waiting" && fillsForm(raw);

const waitingStepOf = (agencyName: string) => (raw: any): StartStep => ({ ...stepOf(agencyName)(raw), orderId: text(raw?.order_id) });

const readAgencyName = async () => text((await callTool("", "agency_get_agency", {}).catch(() => ({})))?.name);

export const mcpStartClient: StartClient = {
  async waiting() {
    const [steps, available, agencyName] = await Promise.all([readOpenSteps(), readAvailableSteps(), readAgencyName()]);
    const starts = itemsOf(steps).filter(fillsForm).map(stepOf(agencyName)).filter(isGroupOrderStart);
    return [...starts, ...itemsOf(available).filter(waitsOnMember).map(waitingStepOf(agencyName))];
  },
  async openSteps() {
    return itemsOf(await readOpenSteps())
      .filter((raw) => fillsForm(raw) || isChatStep(raw))
      .map(stepOf(""));
  },
  async poster() {
    try {
      const out = await callTool("", "market_get_group_order_poster", {});
      return { kind: "one", poster: { id: text(out?.poster_id), name: text(out?.poster_name) } };
    } catch {
      const approved = itemsOf(await callTool("", "market_list_posters", {})).filter((p) => text(p?.status) === "approved");
      return approved.length > 1 ? { kind: "several", posters: approved.map(posterOf) } : { kind: "none" };
    }
  },
  async start(draft) {
    const out = await callTool("", "market_start_group_order", {
      poster_id: draft.posterId,
      product: draft.product,
      price: draft.price,
      minimum: draft.minimum,
    });
    return { id: text(out?.id) };
  },
};

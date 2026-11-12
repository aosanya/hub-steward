import { openAgencyId } from "../agency/open";

type Sent = { id: string; orderId: string; title: string; after?: string };

export const afterWords = (reply: { done: boolean; next: { roleName: string } | null }) =>
  reply.done ? "Done" : reply.next?.roleName ? `Next: ${reply.next.roleName}` : "";

type Kept = Sent & { agencyId: string };

let sent: Kept[] = [];
let local = 0;

const same = (a: Pick<Kept, "agencyId" | "id" | "orderId">, b: Pick<Kept, "agencyId" | "id" | "orderId">) =>
  a.agencyId === b.agencyId && a.id === b.id && a.orderId === b.orderId;

export const markSent = (step: Sent) => {
  const kept = { ...step, orderId: step.orderId || `sent-${++local}`, agencyId: openAgencyId() };
  sent = [...sent.filter((one) => !same(one, kept)), kept];
};

export const wasSent = (step: Pick<Sent, "id" | "orderId">) => sent.some((one) => same(one, { ...step, agencyId: openAgencyId() }));

export const sentAfter = (step: Pick<Sent, "id" | "orderId">) =>
  sent.find((one) => same(one, { ...step, agencyId: openAgencyId() }))?.after ?? "";

export const wasStarted = (stepId: string) => sent.some((one) => one.agencyId === openAgencyId() && one.id === stepId);

export const sentSteps = (): Sent[] => sent.filter((one) => one.agencyId === openAgencyId());

export const forgetSent = () => {
  sent = [];
  local = 0;
};

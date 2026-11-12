import { openAgencyId } from "../agency/open";
import { readKept, removeKept, writeKept } from "../storage/kept";

type Sent = { id: string; orderId: string; title: string };

type Kept = Sent & { agencyId: string };

const storageKey = "hs-sent-steps";

const isKept = (value: unknown) => Array.isArray(value);

let sent: Kept[] | null = null;

const all = () => (sent ??= readKept<Kept[]>(storageKey, [], isKept));

const keep = (next: Kept[]) => {
  sent = next;
  writeKept(storageKey, next);
};

const localNumber = (one: Kept) => Number(/^sent-(\d+)$/.exec(one.orderId)?.[1] ?? 0);

const nextLocalNumber = () => Math.max(0, ...all().map(localNumber)) + 1;

const same = (a: Pick<Kept, "agencyId" | "id" | "orderId">, b: Pick<Kept, "agencyId" | "id" | "orderId">) =>
  a.agencyId === b.agencyId && a.id === b.id && a.orderId === b.orderId;

export const markSent = (step: Sent) => {
  const kept = { ...step, orderId: step.orderId || `sent-${nextLocalNumber()}`, agencyId: openAgencyId() };
  keep([...all().filter((one) => !same(one, kept)), kept]);
};

export const wasSent = (step: Pick<Sent, "id" | "orderId">) => all().some((one) => same(one, { ...step, agencyId: openAgencyId() }));

export const wasStarted = (stepId: string) => all().some((one) => one.agencyId === openAgencyId() && one.id === stepId);

export const sentSteps = (): Sent[] => all().filter((one) => one.agencyId === openAgencyId());

export const forgetSent = () => {
  sent = [];
  removeKept(storageKey);
};

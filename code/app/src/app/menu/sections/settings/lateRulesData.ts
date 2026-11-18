import { chargeNames, listOf, readLateRule, text } from "../finance/financeData";

export type Charge = { id: string; name: string; days: string; role: string };

export type Kinds = { all: Map<string, string>; open: { value: string; label: string }[] };

export type LateRulesView = { charges: Charge[]; kinds: Kinds };

export const noRuleWords = "No rule: late from the day after the due date, nobody is reminded";

const unknownRole = "a role no longer in use";

export const loadKinds = async (): Promise<Kinds> => {
  const kinds = await listOf("actor_list_role_kinds");
  return {
    all: new Map(kinds.map((kind) => [text(kind, "id"), text(kind, "name")])),
    open: kinds.filter((kind) => !kind.retired_at && text(kind, "name") !== "").map((kind) => ({ value: text(kind, "id"), label: text(kind, "name") })),
  };
};

export const loadLateRules = async (): Promise<LateRulesView> => {
  const [names, kinds] = await Promise.all([chargeNames(), loadKinds()]);
  const charges = await Promise.all(
    [...names].map(async ([id, name]) => {
      const rule = await readLateRule(id);
      return { id, name, days: rule ? String(rule.days) : "", role: rule?.role ?? "" };
    }),
  );
  return { charges, kinds };
};

export const ruleWords = (charge: Charge, kinds: Kinds) => {
  if (charge.days === "" || charge.role === "") return noRuleWords;
  const days = Number(charge.days);
  return `Late after ${days} ${days === 1 ? "day" : "days"} · reminds ${kinds.all.get(charge.role) ?? unknownRole}`;
};

const wholeDays = /^\d+$/;

export const problemOf = (charge: Charge, now: { days: string; role: string }) => {
  const days = now.days.trim();
  if (days === "" && now.role === "") return charge.days === "" ? "" : `${charge.name} already has a rule: change it rather than leave it empty.`;
  if (days === "") return `Give ${charge.name} the days after the due date.`;
  if (!wholeDays.test(days)) return `${charge.name}: days must be a whole number, 0 or more.`;
  if (now.role === "") return `Give ${charge.name} a role to remind.`;
  return "";
};

export const changedOf = (charge: Charge, now: { days: string; role: string }) => now.days.trim() !== charge.days || now.role !== charge.role;

export const ruleValue = (now: { days: string; role: string }) => JSON.stringify({ days: Number(now.days.trim()), role: now.role });

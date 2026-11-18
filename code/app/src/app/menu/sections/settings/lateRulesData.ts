import { loadRoleKinds, roleKindName, type RoleKind } from "../../roleKinds";
import { chargeNames, readLateRuleState } from "../finance/financeData";

export type Charge = { id: string; name: string; days: string; role: string };

export type LateRulesView = { charges: Charge[]; kinds: RoleKind[] };

export const lateRulesUnread = "the late rules could not be read";

export const noRuleWords = "No rule: late from the day after the due date, nobody is reminded";

export const loadLateRules = async (): Promise<LateRulesView> => {
  const [names, kinds] = await Promise.all([chargeNames(), loadRoleKinds()]);
  const states = await Promise.all([...names].map(async ([id, name]) => ({ id, name, state: await readLateRuleState(id) })));
  if (states.some(({ state }) => state.unread)) throw new Error(lateRulesUnread);
  const charges = states.map(({ id, name, state }) => ({ id, name, days: state.rule ? String(state.rule.days) : "", role: state.rule?.role ?? "" }));
  return { charges, kinds };
};

export const ruleWords = (charge: Charge, kinds: RoleKind[]) => {
  if (charge.days === "" || charge.role === "") return noRuleWords;
  const days = Number(charge.days);
  return `Late after ${days} ${days === 1 ? "day" : "days"} · reminds ${roleKindName(kinds, charge.role)}`;
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

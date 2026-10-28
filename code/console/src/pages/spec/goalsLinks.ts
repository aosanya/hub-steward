import { useLocation } from "react-router-dom";
import { hubPath } from "../../api";
import { useI18n } from "../../i18n";
import { noNote, type Note } from "./profileOutcome";

export type GoalsTarget = { goal?: string; objective?: string; add?: "goal" | "objective" };

export const goalsHref = (hubId: string, target: GoalsTarget = {}) => {
  const params = new URLSearchParams();
  if (target.goal) params.set("goal", target.goal);
  if (target.objective) params.set("objective", target.objective);
  if (target.add) params.set("add", target.add);
  const query = params.toString();
  return hubPath(hubId, "goals") + (query ? `?${query}` : "");
};

export type Arrival = { outcome?: string };

export function useArrivedNote(): Note {
  const { t } = useI18n();
  const { state } = useLocation();
  return (state as Arrival | null)?.outcome === "accepted" ? { text: t("waitingForApproval"), failed: false } : noNote;
}

export const withCode = (template: string, code: string, fallback: string) => (code ? template.replace("{code}", code) : fallback);

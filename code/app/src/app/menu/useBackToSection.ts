import { useLocation, useNavigate } from "react-router-dom";
import { mcpAgencyClient, type AgencyView } from "../../features/agency/modules";
import { useLoad } from "../../features/forms/useLoad";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { headById, titleOf } from "./sectionHeads";

type Origin = { path: string; title: string; sectionId?: string };

const originOf = (state: unknown): Origin | null => {
  const from = (state as { from?: Partial<Origin> } | null)?.from;
  if (typeof from?.path !== "string" || typeof from.title !== "string") return null;
  return { path: from.path, title: from.title, sectionId: typeof from.sectionId === "string" ? from.sectionId : undefined };
};

const sectionTitleOf = (origin: Origin, view: AgencyView | null) => {
  const head = origin.sectionId ? headById(origin.sectionId) : undefined;
  return head ? titleOf(head, view) : origin.title;
};

export function useBackToSection(): { onBack?: () => void; backLabel?: string } {
  const navigate = useNavigate();
  const origin = originOf(useLocation().state);
  const view = useLoad(() => (origin?.sectionId ? mcpAgencyClient.read() : Promise.resolve(null)), `back-section:${origin?.sectionId ?? ""}:${openAgencyId()}`);
  if (!origin) return {};
  return { onBack: () => navigate(origin.path), backLabel: sectionTitleOf(origin, view.state === "ready" ? view.data : null) };
}

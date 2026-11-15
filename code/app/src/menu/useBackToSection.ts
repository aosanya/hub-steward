import { useLocation, useNavigate } from "react-router-dom";

type Origin = { path: string; title: string };

const originOf = (state: unknown): Origin | null => {
  const from = (state as { from?: Partial<Origin> } | null)?.from;
  return typeof from?.path === "string" && typeof from.title === "string" ? { path: from.path, title: from.title } : null;
};

export function useBackToSection(): { onBack?: () => void; backLabel?: string } {
  const navigate = useNavigate();
  const origin = originOf(useLocation().state);
  return origin ? { onBack: () => navigate(origin.path), backLabel: origin.title } : {};
}

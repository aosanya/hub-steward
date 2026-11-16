import type { StartStep } from "../../features/market/start/api";
import { useLanguage } from "../../features/entry/language";
import { routes } from "../../routes";
import { Button } from "../../shared/ui/Button";
import { councilViewOf } from "./stepLinks";

export function CouncilViewLink({ step }: { step: Pick<StartStep, "title"> }) {
  const { words } = useLanguage();
  const view = councilViewOf(step);
  if (view === "lateMatters") return <Button to={routes.lateMatters.path()}>{words.lateMattersTitle}</Button>;
  if (view === "councilRisks") return <Button to={routes.councilRisks.path()}>{words.councilRisksTitle}</Button>;
  return null;
}

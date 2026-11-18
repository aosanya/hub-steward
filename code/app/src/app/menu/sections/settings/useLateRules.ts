import { useState } from "react";
import { useLoad } from "../../../../features/forms/useLoad";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { loadLateRules } from "./lateRulesData";

export function useLateRules(scope: string) {
  const [attempt, setAttempt] = useState(0);
  const view = useLoad(loadLateRules, `${scope}:${openAgencyId()}:${attempt}`);
  return { view, retry: () => setAttempt((was) => was + 1) };
}

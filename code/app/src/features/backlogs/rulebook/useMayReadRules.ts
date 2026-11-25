import { useLoad } from "../../forms/useLoad";
import { openAgencyId } from "../../../shared/wakala/openAgency";
import { askMayReadRules } from "./access";

export function useMayReadRules(ask: () => Promise<boolean> = askMayReadRules): boolean {
  const may = useLoad(ask, `may-read-rules:${openAgencyId()}`);
  return may.state === "ready" && may.data;
}

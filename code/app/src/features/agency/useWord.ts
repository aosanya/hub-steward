import { useLoad } from "../forms/useLoad";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { mcpAgencyClient, word, type AgencyClient } from "./modules";

export type Wording = (generic: string) => string;

export function useWord(section?: string, agency: AgencyClient = mcpAgencyClient): Wording {
  const view = useLoad(() => agency.read(), `menu-modules:${openAgencyId()}`);
  const read = view.state === "ready" ? view.data : null;
  return (generic) => word(read, generic, section);
}

import { openAgencyId } from "../../shared/wakala/openAgency";
import { useLoad } from "../../features/forms/useLoad";
import { readHome } from "./homeDeclaration";

export const useHomeDeclaration = (attempt: number) => useLoad(readHome, `home-declaration:${openAgencyId()}:${attempt}`);

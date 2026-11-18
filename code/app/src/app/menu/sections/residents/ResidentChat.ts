import { useMay } from "../../../../features/agency/useMay";
import { useChatAboutOpen } from "../../../chatAbout";
import { residentRead } from "./index";
import { residentPaths } from "./paths";

export type ResidentRef = { id: string; name: string };

export function useChatAboutResident(resident: ResidentRef | null) {
  const mayRead = useMay(residentRead);
  const known = mayRead && resident !== null && resident.id !== "" ? resident : null;
  useChatAboutOpen(known ? { kind: "resident", id: known.id, name: known.name } : null, known ? residentPaths.people.path({ person: known.id }) : "");
}

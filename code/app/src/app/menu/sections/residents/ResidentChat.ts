import { useMay } from "../../../../features/agency/useMay";
import { useChatAboutOpen } from "../../../chatAbout";
import { residentRead } from "./index";

export type ResidentRef = { id: string; name: string };

export function useChatAboutResident(resident: ResidentRef | null) {
  const mayRead = useMay(residentRead);
  const known = mayRead && resident !== null && resident.id !== "" ? resident : null;
  useChatAboutOpen(known ? { kind: "resident", id: known.id, name: known.name } : null);
}

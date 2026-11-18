import { useNavigate } from "react-router-dom";
import { residentPaths } from "./paths";

export const personSectionKeys = ["groups", "applications", "wishes", "bills", "holdings"] as const;

export type PersonSectionKey = (typeof personSectionKeys)[number];

export const useOpenSection = (personId: string, section: PersonSectionKey) => {
  const navigate = useNavigate();
  return () => navigate(residentPaths.personSection.path({ id: personId, section }));
};

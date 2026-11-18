import { useMay } from "../../../../features/agency/useMay";
import { residentRead } from "./index";
import { personNameOf } from "./personName";
import { residentPaths } from "./paths";
import { useChatAboutSubject } from "./SubjectChat";

const words = (item: Record<string, unknown>, key: string) => (typeof item[key] === "string" ? (item[key] as string) : "");

export function ChatAboutRegistration({ person }: { person: Record<string, unknown> }) {
  const mayRead = useMay(residentRead);
  const id = String(person.id ?? "");
  const subject = mayRead && id !== "" ? { kind: "registration" as const, id, name: personNameOf(person), extra: { group: words(person, "group_name"), asked: words(person, "asked") } } : null;
  useChatAboutSubject(subject, residentPaths.registrations.path());
  return null;
}

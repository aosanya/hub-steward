import { useChatAboutSubject } from "../residents/SubjectChat";
import { personNameOf } from "../residents/personName";

export function ChatAboutStaff({ person, back }: { person: Record<string, unknown>; back: string }) {
  const id = String(person.id ?? "");
  useChatAboutSubject(id === "" ? null : { kind: "staff", id, name: personNameOf(person) }, `${back}?person=${id}`);
  return null;
}

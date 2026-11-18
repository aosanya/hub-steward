import { personNameOf } from "./personName";
import { useChatAboutResident } from "./ResidentChat";

export function ChatAboutResident({ person }: { person: Record<string, unknown> }) {
  useChatAboutResident({ id: String(person.id ?? ""), name: personNameOf(person) });
  return null;
}

import type { ChatAbout } from "../../../chatAbout";
import { useChatAboutSubject } from "../residents/SubjectChat";

type Props = { kind: ChatAbout["kind"]; id: string; name: string; back: string; extra?: Record<string, string> };

export function ChatAboutProperty({ kind, id, name, back, extra }: Props) {
  useChatAboutSubject(id === "" ? null : { kind, id, name, extra }, back);
  return null;
}

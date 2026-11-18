import type { ChatAbout } from "../../../chatAbout";
import { useChatAboutSubject } from "../residents/SubjectChat";

export function ChatAboutService({ about, back }: { about: ChatAbout; back: string }) {
  useChatAboutSubject(about, back);
  return null;
}

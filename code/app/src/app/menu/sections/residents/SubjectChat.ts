import { useChatAboutOpen, type ChatAbout } from "../../../chatAbout";

export function useChatAboutSubject(subject: ChatAbout | null, back: string) {
  useChatAboutOpen(subject && subject.id !== "" ? subject : null, subject && subject.id !== "" ? back : "");
}

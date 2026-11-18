import { useLocation } from "react-router-dom";
import { useChatAboutOpen, type ChatAbout } from "../../../app/chatAbout";

export function ChatAboutBacklog({ about }: { about: ChatAbout }) {
  const here = useLocation();
  useChatAboutOpen(about, here.pathname + here.search);
  return null;
}

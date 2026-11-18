import { useSearchParams } from "react-router-dom";
import type { ChatAbout } from "../../../chatAbout";
import { useChatAboutSubject } from "../residents/SubjectChat";

export const itemParam = "item";

export const useChosenItem = () => useSearchParams()[0].get(itemParam) ?? undefined;

export const text = (item: Record<string, unknown>, key: string) => {
  const value = item[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

export function ChatAboutItem({ about, back }: { about: ChatAbout; back: string }) {
  useChatAboutSubject(about.id === "" ? null : about, `${back}?${itemParam}=${about.id}`);
  return null;
}

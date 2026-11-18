import { useLocation } from "react-router-dom";
import { useChatAboutSubject } from "../residents/SubjectChat";

export const wishParam = "wish";

type Item = Record<string, unknown>;

const textOf = (item: Item, key: string) => (typeof item[key] === "string" ? (item[key] as string) : "");

const countOf = (item: Item, key: string) => (typeof item[key] === "number" ? String(item[key]) : "0");

export function ChatAboutWish({ wish }: { wish: Item }) {
  const id = textOf(wish, "id");
  const back = `${useLocation().pathname}?${wishParam}=${id}`;
  const subject = id === "" ? null : { kind: "wish" as const, id, name: textOf(wish, "title"), extra: { raisedBy: countOf(wish, "raised_by"), meToo: countOf(wish, "me_too") } };
  useChatAboutSubject(subject, back);
  return null;
}

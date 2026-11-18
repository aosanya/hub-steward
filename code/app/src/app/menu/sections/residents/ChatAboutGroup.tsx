import { useChatAboutSubject } from "./SubjectChat";

const words = (item: Record<string, unknown>, key: string) => (typeof item[key] === "string" ? (item[key] as string) : "");

export function ChatAboutGroup({ group, back }: { group: Record<string, unknown>; back: string }) {
  const id = words(group, "id");
  useChatAboutSubject(id === "" ? null : { kind: "group", id, name: words(group, "name") }, `${back}?group=${id}`);
  return null;
}

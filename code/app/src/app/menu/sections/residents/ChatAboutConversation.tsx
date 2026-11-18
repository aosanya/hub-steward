import { residentPaths } from "./paths";
import { useChatAboutSubject } from "./SubjectChat";

const words = (item: Record<string, unknown>, key: string) => (typeof item[key] === "string" ? (item[key] as string) : "");

export function ChatAboutConversation({ row }: { row: Record<string, unknown> }) {
  const groupId = words(row, "group_id");
  const threadId = words(row, "id");
  const subject = groupId === "" || threadId === "" ? null : { kind: "conversation" as const, id: groupId, name: words(row, "name"), extra: { thread: threadId } };
  useChatAboutSubject(subject, `${residentPaths.communications.path()}?thread=${threadId}`);
  return null;
}

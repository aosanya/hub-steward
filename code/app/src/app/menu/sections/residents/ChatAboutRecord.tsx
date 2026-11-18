import { recordOwnerKey, recordRowIdKey } from "../../liveRecordRows";
import { useChatAboutSubject } from "./SubjectChat";

type Item = Record<string, unknown>;

export type RecordChat = { kind: "business" | "trader"; back: (id: string) => string };

const words = (item: Item, key: string) => {
  const value = item[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

export function ChatAboutRecord({ row, titlePrompt, prompts, chat }: { row: Item; titlePrompt: string; prompts: string[]; chat: RecordChat }) {
  const id = words(row, recordRowIdKey);
  const details = prompts
    .filter((prompt) => words(row, prompt) !== "")
    .map((prompt) => `${prompt}: ${words(row, prompt)}`)
    .join(". ");
  const subject = id === "" ? null : { kind: chat.kind, id, name: words(row, titlePrompt), extra: { owner: words(row, recordOwnerKey), details } };
  useChatAboutSubject(subject, chat.back(id));
  return null;
}

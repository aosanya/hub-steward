import { useChatAboutSubject } from "../residents/SubjectChat";
import { issuePaths } from "./paths";
import { text, type Item } from "../staff/staffData";

export function ChatAboutRounds({ row }: { row: Item }) {
  useChatAboutSubject({ kind: "rounds", id: text(row, "id"), name: text(row, "name") }, issuePaths.rounds.path());
  return null;
}

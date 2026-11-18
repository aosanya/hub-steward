import { useChatAboutSubject } from "../residents/SubjectChat";
import { staffPaths } from "./paths";
import { text, type Item } from "./staffData";

export function ChatAboutRole({ role }: { role: Item }) {
  const subjectId = text(role, "kindId") || text(role, "id");
  const draft = text(role, "draft");
  useChatAboutSubject({ kind: "role", id: subjectId, name: text(role, "name"), extra: draft === "" ? {} : { draft } }, `${staffPaths.roles.path()}?role=${text(role, "id")}`);
  return null;
}

import { useChatAboutSubject } from "../residents/SubjectChat";
import { staffPaths } from "./paths";
import { text, type Item } from "./staffData";

export function ChatAboutRole({ role }: { role: Item }) {
  const kindId = text(role, "kindId");
  const draft = text(role, "draft");
  useChatAboutSubject(kindId === "" ? null : { kind: "role", id: kindId, name: text(role, "name"), extra: draft === "" ? {} : { draft } }, `${staffPaths.roles.path()}?role=${text(role, "id")}`);
  return null;
}

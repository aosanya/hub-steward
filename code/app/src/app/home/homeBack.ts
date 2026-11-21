import { homeTab } from "../tabs";
import { titleIn, type HomeNode } from "./homeDeclaration";
import { homePath, homeRowPagePath, homeSectionPath } from "./homePaths";

export const backOf = (parent: HomeNode | undefined, scopeRowId: string, languageCode: string) => {
  if (!parent) return { to: homePath(), label: homeTab.label };
  const to = scopeRowId ? homeRowPagePath(parent.key, scopeRowId) : homeSectionPath(parent.key);
  return { to, label: titleIn(parent, languageCode) };
};

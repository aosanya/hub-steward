import type { PaneTreeRow } from "../../shared/ui/PaneTree";
import { iconOf } from "./HomeNodeRows";
import { isSection, titleIn, type HomeNode } from "./homeDeclaration";
import type { HomeFacts } from "./homeFacts";
import { splitEntries, tiedKeysIn } from "./homeRowSteps";

type Words = { languageCode: string; workflows: string };

const itemOf = (node: HomeNode, facts: HomeFacts, level: number, expanded: ReadonlySet<string>, words: Words): PaneTreeRow => ({
  id: node.key,
  name: titleIn(node, words.languageCode),
  level,
  icon: iconOf(node, facts),
  expandable: isSection(node),
  open: isSection(node) && expanded.has(node.key),
});

const nested = (nodes: HomeNode[], facts: HomeFacts, level: number, expanded: ReadonlySet<string>, words: Words): PaneTreeRow[] => {
  const tied = tiedKeysIn(nodes, facts);
  return nodes
    .filter((node) => !tied.has(node.key))
    .flatMap((node) => [itemOf(node, facts, level, expanded, words), ...(isSection(node) && expanded.has(node.key) ? nested(node.entries, facts, level + 1, expanded, words) : [])]);
};

export const treeRowsOf = (entries: HomeNode[], facts: HomeFacts, expanded: ReadonlySet<string>, words: Words): PaneTreeRow[] => {
  const { plain, workflows } = splitEntries(entries, facts);
  const body = plain.flatMap((node) => [itemOf(node, facts, 1, expanded, words), ...(isSection(node) && expanded.has(node.key) ? nested(node.entries, facts, 2, expanded, words) : [])]);
  return workflows.length === 0 ? body : [...body, { heading: words.workflows }, ...workflows.map((node) => itemOf(node, facts, 1, expanded, words))];
};

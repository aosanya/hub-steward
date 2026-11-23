import type { PaneTreeRow } from "../../shared/ui/PaneTree";
import { iconOf } from "./HomeNodeRows";
import { isSection, titleIn, type HomeNode } from "./homeDeclaration";
import type { HomeFacts } from "./homeFacts";
import { isWorkflowNode } from "./homeRowSteps";
import { addItemsOf, sectionPartsOf } from "./homeWorkflows";

type Words = { languageCode: string; workflows: string };

const itemOf = (node: HomeNode, facts: HomeFacts, level: number, expanded: ReadonlySet<string>, words: Words): PaneTreeRow => ({
  id: node.key,
  name: titleIn(node, words.languageCode),
  level,
  icon: iconOf(node, facts),
  expandable: isSection(node),
  open: isSection(node) && expanded.has(node.key),
});

const nested = (nodes: HomeNode[], facts: HomeFacts, level: number, expanded: ReadonlySet<string>, words: Words): PaneTreeRow[] =>
  nodes
    .filter((node) => !isWorkflowNode(node))
    .flatMap((node) => [itemOf(node, facts, level, expanded, words), ...(isSection(node) && expanded.has(node.key) ? nested(node.entries, facts, level + 1, expanded, words) : [])]);

export const treeRowsOf = (entries: HomeNode[], facts: HomeFacts, expanded: ReadonlySet<string>, words: Words): PaneTreeRow[] => {
  const { plain, workflows } = sectionPartsOf(entries);
  const adds = addItemsOf(entries, facts, words.languageCode);
  const body = plain.flatMap((node) => [itemOf(node, facts, 1, expanded, words), ...(isSection(node) && expanded.has(node.key) ? nested(node.entries, facts, 2, expanded, words) : [])]);
  if (adds.length + workflows.length === 0) return body;
  const addRows: PaneTreeRow[] = adds.map((item) => ({ id: item.id, name: item.name, level: 1, icon: "play", expandable: false, open: false }));
  return [...body, { heading: words.workflows }, ...addRows, ...workflows.map((node) => itemOf(node, facts, 1, expanded, words))];
};

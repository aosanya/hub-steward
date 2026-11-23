import { isSection, nodeOf, type HomeNode } from "./homeDeclaration";

export const toolsKey = "tools";

export const settingsKey = "settings";

const toolsNode = nodeOf({
  key: toolsKey,
  title: "Tools",
  titles: { sw: "Zana", hu: "Eszközök" },
  icon: "tools",
  entries: [
    { key: "backlogs", title: "Backlogs", titles: { sw: "Orodha za kazi", hu: "Feladatlisták" }, target: { type: "backlogs" } },
    { key: "files", title: "Files", titles: { sw: "Faili", hu: "Fájlok" }, target: { type: "files" } },
  ],
});

export const toolsOf = () => toolsNode;

const insideMyWork = new Set(["start", "ongoing"]);

const withoutMyWork = (nodes: HomeNode[]): HomeNode[] =>
  nodes.filter((node) => !insideMyWork.has(node.target?.type ?? "")).map((node) => (isSection(node) ? { ...node, entries: withoutMyWork(node.entries) } : node));

export const homeLayout = (declared: HomeNode[]): HomeNode[] => {
  const kept = withoutMyWork(declared);
  if (kept.some((node) => node.key === toolsKey)) return kept;
  return [...kept.filter((node) => node.key !== settingsKey), toolsNode, ...kept.filter((node) => node.key === settingsKey)];
};

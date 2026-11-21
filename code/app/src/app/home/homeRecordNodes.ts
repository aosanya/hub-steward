import type { Condition } from "../menu/declaredRecord";
import { readHome, type HomeNode } from "./homeDeclaration";

export type DeclaredNode = {
  key: string;
  title: string;
  titles: Record<string, string>;
  pageOf: string;
  targetType: string;
  target: string;
  where: Condition[];
  entries: DeclaredNode[];
};

const declaredOf = (node: HomeNode): DeclaredNode => ({
  key: node.key,
  title: node.title,
  titles: node.titles,
  pageOf: node.pageOf,
  targetType: node.target?.type ?? "",
  target: node.target?.ref ?? "",
  where: node.target?.where ?? [],
  entries: node.entries.map(declaredOf),
});

export const loadDeclaredNodes = async (): Promise<DeclaredNode[]> => (await readHome()).map(declaredOf);

export const findNode = (nodes: DeclaredNode[], key: string): DeclaredNode | null => {
  for (const node of nodes) {
    if (node.key === key) return node;
    const inside = findNode(node.entries, key);
    if (inside) return inside;
  }
  return null;
};

export const titleIn = (node: DeclaredNode, languageCode: string) => (node.titles[languageCode] ?? "").trim() || node.title;

export const recordEntryIn = (nodes: DeclaredNode[], sectionKey: string, code: string, entryKey: string | null): DeclaredNode | null => {
  const named = entryKey ? findNode(nodes, entryKey) : null;
  if (named && named.targetType === "record" && named.target === code) return named;
  const section = findNode(nodes, sectionKey);
  const entries = (section?.entries ?? []).filter((node) => node.targetType === "record" && node.target === code);
  return entries[0] ?? null;
};

export const pageKeyOf = (nodes: DeclaredNode[], code: string): string | null => {
  for (const node of nodes) {
    if (node.pageOf === code) return node.key;
    const inside = pageKeyOf(node.entries, code);
    if (inside) return inside;
  }
  return null;
};

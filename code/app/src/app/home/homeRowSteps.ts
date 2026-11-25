import { pageOfRecord, pathTo, type HomeNode } from "./homeDeclaration";
import type { HomeFacts } from "./homeFacts";
import { shownNodes } from "./homeVisibility";

export const singularOf = (name: string) => name.trim().toLocaleLowerCase().replace(/ies$/, "y").replace(/s$/, "");

export const isWorkflowNode = (node: HomeNode) => node.target?.type === "workflow";

export const scopedToRow = (node: HomeNode): HomeNode => (node.target && isWorkflowNode(node) ? { ...node, target: { ...node.target, scope: "row.order" } } : node);

export type RowSteps = { tied: HomeNode[]; page: HomeNode | undefined; pageEntries: HomeNode[] };

export const rowStepsOf = (declared: HomeNode[], facts: HomeFacts, entryKey: string, recordKey: string, workflowId: string): RowSteps => {
  const parent = pathTo(declared, entryKey).at(-2);
  const siblings = parent ? shownNodes(parent.entries, facts) : [];
  const page = pageOfRecord(declared, recordKey);
  return {
    tied: workflowId === "" ? [] : siblings.filter((node) => isWorkflowNode(node) && node.target?.workflowId === workflowId).map(scopedToRow),
    page,
    pageEntries: page ? shownNodes(page.entries, facts) : [],
  };
};

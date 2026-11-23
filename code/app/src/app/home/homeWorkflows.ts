import type { RowAction } from "../../features/market";
import type { MemberStep } from "../../features/steps/api";
import { openedRow, type StepOrigin as StepOrigin_ } from "../../features/steps/rowStep";
import { routes } from "../routes";
import { isWorkflowNode } from "./homeRowSteps";
import type { HomeNode } from "./homeDeclaration";
import type { HomeFacts } from "./homeFacts";
import { homeRecordPath, homeRowPagePath } from "./homePaths";
import { withQuery } from "./homeRecordRoute";
import { titleIn } from "./homeDeclaration";

export type AddItem = { id: string; name: string; step: MemberStep; entry: HomeNode };

export type StepOrigin = Required<Pick<StepOrigin_, "from" | "landing">>;

const addPrefix = "add:";

export const addIdOf = (recordCode: string) => `${addPrefix}${recordCode}`;

export const isAddId = (id: string) => id.startsWith(addPrefix);

const everyNode = (nodes: HomeNode[]): HomeNode[] => nodes.flatMap((node) => [node, ...everyNode(node.entries)]);

export const rowStepOf = (facts: HomeFacts, recordCode: string, action: RowAction): MemberStep | undefined =>
  facts.rowSteps.find((step) => step.recordCode === recordCode && step.rowAction === action && !step.replacedBy);

export const addItemsOf = (entries: HomeNode[], facts: HomeFacts, languageCode: string): AddItem[] => {
  const records = everyNode(entries).filter((node) => node.target?.type === "record" && node.target.ref !== "");
  const first = records.filter((node, at) => records.findIndex((other) => other.target?.ref === node.target?.ref) === at);
  return first.flatMap((entry) => {
    const step = rowStepOf(facts, entry.target?.ref ?? "", "add");
    return step ? [{ id: addIdOf(entry.target?.ref ?? ""), name: step.workflowName || step.title || titleIn(entry, languageCode), step, entry }] : [];
  });
};

export const sectionPartsOf = (entries: HomeNode[]) => ({
  plain: entries.filter((node) => !isWorkflowNode(node)),
  workflows: everyNode(entries).filter(isWorkflowNode),
});

export const stepPathOf = (step: Pick<MemberStep, "id">, rowId?: string) => routes.step.path({ stepId: step.id }, rowId ? { row: rowId } : undefined);

export const addOriginOf = (item: AddItem, languageCode: string): StepOrigin => {
  const path = homeRecordPath(item.entry.key, item.entry.target?.ref ?? "");
  return { from: { path, title: titleIn(item.entry, languageCode) }, landing: withQuery(path, `open=${openedRow}`) };
};

export const rowPageLanding = (pageKey: string) => `${homeRowPagePath(pageKey, "")}${openedRow}`;

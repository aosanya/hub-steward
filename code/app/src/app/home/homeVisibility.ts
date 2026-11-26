import { holdsPermission } from "../../features/agency/useMyPermissions";
import { menuItemOf, menuItemShown } from "../menu/sections";
import { allIssuesId } from "../../features/backlogs";
import { isSection, type HomeNode } from "./homeDeclaration";
import type { HomeFacts, OpenStep } from "./homeFacts";

const holdsNode = (node: HomeNode, facts: HomeFacts) =>
  (node.permission === "" || holdsPermission(facts.access, node.permission)) && (node.roles.length === 0 || facts.access.owner || node.roles.some((role) => facts.access.roles.includes(role)));

export const backlogOf = (node: HomeNode, facts: HomeFacts) => facts.backlogs.find((backlog) => backlog.id === node.target?.ref) ?? facts.backlogs.find((backlog) => backlog.name === node.target?.ref);

export const menuOf = (node: HomeNode, facts: HomeFacts) => {
  const found = menuItemOf(node.target?.ref ?? "");
  const shown = found && found.item.path && menuItemShown(found.item, { holds: (permission) => holdsPermission(facts.access, permission), view: facts.view, sectionModule: found.section.module });
  return found && shown ? found : undefined;
};

export const stepsOf = (node: HomeNode, facts: HomeFacts) =>
  facts.openSteps.filter((step) => {
    const target = node.target;
    if (!target) return false;
    if (target.workflowId !== "" && step.workflowId !== undefined) return step.workflowId === target.workflowId && (target.stepId === "" || step.id === target.stepId);
    return target.name === "" || step.workflowName === target.name;
  });

type Row = { rowId: string; orderId: string };

const isOfRow = (step: OpenStep, row: Row) => (step.subjectRecord ? step.rowId === row.rowId : row.orderId !== "" && step.orderId === row.orderId);

export const waitingStepsOf = (node: HomeNode, facts: HomeFacts, row: Row | undefined) => {
  const mine = stepsOf(node, facts);
  if (node.target?.scope !== "row.order") return mine;
  return row ? mine.filter((step) => isOfRow(step, row)) : [];
};

const targetShown = (node: HomeNode, facts: HomeFacts) => {
  const target = node.target;
  if (!target) return false;
  if (target.type === "record") return target.ref !== "";
  if (target.type === "workflow") return stepsOf(node, facts).length > 0;
  if (target.type === "backlog") return backlogOf(node, facts) !== undefined;
  if (target.type === "backlogs") return facts.backlogs.some((backlog) => backlog.id !== allIssuesId);
  if (target.type === "menu") return menuOf(node, facts) !== undefined;
  if (target.type === "files") return facts.filesMounted;
  if (target.type === "start" || target.type === "ongoing") return facts.holdsWorkflows;
  return false;
};

export const shownNodes = (nodes: HomeNode[], facts: HomeFacts): HomeNode[] =>
  nodes.flatMap((node) => {
    if (!holdsNode(node, facts)) return [];
    if (!isSection(node)) return targetShown(node, facts) ? [node] : [];
    if (node.pageOf !== "") return [];
    const entries = shownNodes(node.entries, facts);
    return entries.length > 0 ? [{ ...node, entries }] : [];
  });

export const shownEntriesIn = (nodes: HomeNode[], facts: HomeFacts): HomeNode[] =>
  nodes.flatMap((node) => {
    if (!holdsNode(node, facts)) return [];
    return isSection(node) ? shownEntriesIn(node.entries, facts) : targetShown(node, facts) ? [node] : [];
  });

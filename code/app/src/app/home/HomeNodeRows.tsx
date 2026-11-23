import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import { filesHomePath } from "../../features/files";
import { issuesPath } from "../../features/backlogs";
import { isGroupOrderForm, startPath, waitingPath } from "../../features/market";
import { Icon, iconNames, type IconName } from "../../shared/ui/Icon";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { doSomethingPath, routes } from "../routes";
import { backlogsTab, ongoingTab, tabPathIn } from "../tabs";
import { isSection, titleIn, type HomeNode } from "./homeDeclaration";
import type { HomeFacts } from "./homeFacts";
import { homeRecordPath, homeRowPagePath, homeSectionPath, homeWaitingPath } from "./homePaths";
import { backlogOf, menuOf, stepsOf, waitingStepsOf } from "./homeVisibility";
import { chatScreenOf, screenOf } from "./workflowScreens";

export type HomeRowContext = { rowId: string; orderId: string };

type Props = { nodes: HomeNode[]; facts: HomeFacts; marked?: boolean; ended?: boolean; row?: HomeRowContext; from?: { path: string; title: string } };

const defaultIcons: Record<string, IconName> = { record: "document", workflow: "play", backlog: "list", backlogs: "list", files: "folder", start: "play", ongoing: "clock" };

const shippedIcon = (name: string): IconName | undefined => iconNames.find((one) => one === name);

export const iconOf = (node: HomeNode, facts: HomeFacts): IconName => {
  const type = node.target?.type ?? "";
  const fixed = type === "menu" ? menuOf(node, facts)?.section.icon : undefined;
  return shippedIcon(node.icon) ?? (isSection(node) ? "folder" : (fixed ?? defaultIcons[type] ?? "folder"));
};

const workflowPathOf = (node: HomeNode, facts: HomeFacts, row: HomeRowContext | undefined) => {
  const mine = waitingStepsOf(node, facts, row);
  if (mine.length === 0) return stepsOf(node, facts).some((step) => !step.orderId) ? doSomethingPath() : homeWaitingPath(node.key, row?.rowId);
  if (mine.length > 1) return doSomethingPath();
  const [step] = mine;
  if (step.opensIn === "chat") return chatScreenOf(step);
  const screen = screenOf(step);
  if (screen) return screen;
  if (step.orderId) return waitingPath(step);
  return isGroupOrderForm(step) ? startPath(step.id) : routes.step.path({ stepId: step.id });
};

export const pathOfNode = (node: HomeNode, facts: HomeFacts, row: HomeRowContext | undefined): string => {
  const target = node.target;
  if (!target) return row ? homeRowPagePath(node.key, row.rowId) : homeSectionPath(node.key);
  if (target.type === "record") return homeRecordPath(node.key, target.ref, row?.rowId);
  if (target.type === "workflow") return workflowPathOf(node, facts, row);
  if (target.type === "backlog") return issuesPath(backlogOf(node, facts)?.id);
  if (target.type === "backlogs") return tabPathIn(backlogsTab, openAgencyId());
  if (target.type === "menu") return menuOf(node, facts)?.item.path?.() ?? homeSectionPath(node.key);
  if (target.type === "files") return filesHomePath();
  if (target.type === "ongoing") return tabPathIn(ongoingTab, openAgencyId());
  return doSomethingPath();
};

export function HomeNodeRows({ nodes, facts, marked = false, ended = false, row, from }: Props) {
  const navigate = useNavigate();
  const { code } = useLanguage();
  return (
    <Rows>
      {nodes.map((node) => (
        <ListRow
          key={node.key}
          title={titleIn(node, code)}
          start={marked ? <span className="mark" aria-hidden="true"><Icon name={iconOf(node, facts)} /></span> : undefined}
          end={ended || isSection(node) ? "›" : undefined}
          onClick={() => navigate(pathOfNode(node, facts, row), from && node.target?.type === "menu" ? { state: { from } } : undefined)}
        />
      ))}
    </Rows>
  );
}

import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import { filesHomePath } from "../../features/files";
import { issuesPath } from "../../features/backlogs";
import { startPath } from "../../features/market";
import { Icon, iconNames, type IconName } from "../../shared/ui/Icon";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { doSomethingPath } from "../routes";
import { ongoingTab, tabPathIn } from "../tabs";
import { isSection, titleIn, type HomeNode } from "./homeDeclaration";
import type { HomeFacts } from "./homeFacts";
import { homeRecordPath, homeRowPagePath, homeRowRecordPath, homeSectionPath } from "./homePaths";
import { backlogOf, menuOf, stepsOf } from "./homeVisibility";
import { chatScreenOf, screenOf } from "./workflowScreens";

export type HomeRowContext = { inKey: string; code: string; rowId: string; pageKey: string };

type Props = { nodes: HomeNode[]; facts: HomeFacts; parentKey?: string; marked?: boolean; ended?: boolean; row?: HomeRowContext; from?: { path: string; title: string } };

const defaultIcons: Record<string, IconName> = { record: "document", workflow: "play", backlog: "list", files: "folder", start: "play", ongoing: "clock" };

const shippedIcon = (name: string): IconName | undefined => iconNames.find((one) => one === name);

const iconOf = (node: HomeNode, facts: HomeFacts): IconName => {
  const type = node.target?.type ?? "";
  const fixed = type === "menu" ? menuOf(node, facts)?.section.icon : undefined;
  return shippedIcon(node.icon) ?? (isSection(node) ? "folder" : (fixed ?? defaultIcons[type] ?? "folder"));
};

const workflowPathOf = (node: HomeNode, facts: HomeFacts) => {
  const mine = stepsOf(node, facts);
  if (mine.length !== 1) return doSomethingPath();
  const [step] = mine;
  return step.opensIn === "chat" ? chatScreenOf(step) : (screenOf(step) ?? startPath(step.id));
};

export const pathOfNode = (node: HomeNode, facts: HomeFacts, parentKey: string | undefined, row: HomeRowContext | undefined): string => {
  const target = node.target;
  if (!target) return row ? homeRowPagePath(row.inKey, row.code, row.rowId, node.key) : homeSectionPath(node.key);
  if (target.type === "record") return `${row ? homeRowRecordPath(row.inKey, row.code, row.rowId, row.pageKey, target.ref) : homeRecordPath(parentKey ?? node.key, target.ref)}?entry=${encodeURIComponent(node.key)}`;
  if (target.type === "workflow") return workflowPathOf(node, facts);
  if (target.type === "backlog") return issuesPath(backlogOf(node, facts)?.id);
  if (target.type === "menu") return menuOf(node, facts)?.item.path?.() ?? homeSectionPath(node.key);
  if (target.type === "files") return filesHomePath();
  if (target.type === "ongoing") return tabPathIn(ongoingTab, openAgencyId());
  return doSomethingPath();
};

export function HomeNodeRows({ nodes, facts, parentKey, marked = false, ended = false, row, from }: Props) {
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
          onClick={() => navigate(pathOfNode(node, facts, parentKey, row), from && node.target?.type === "menu" ? { state: { from } } : undefined)}
        />
      ))}
    </Rows>
  );
}

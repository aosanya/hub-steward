import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import { PaneTree } from "../../shared/ui/PaneTree";
import { Shell } from "../Shell";
import { homeTab } from "../tabs";
import { pathOfNode } from "./HomeNodeRows";
import { findNode, isSection, titleIn, type HomeNode } from "./homeDeclaration";
import type { HomeFacts } from "./homeFacts";
import { homePath, homeSectionPath } from "./homePaths";
import { treeRowsOf } from "./homeTree";
import { addItemsOf, addOriginOf, stepPathOf } from "./homeWorkflows";
import "../../shared/ui/paneWindow.css";
import "./homeWindow.css";

type Props = { root: HomeNode; facts: HomeFacts; selectedKey: string; opened: string[]; children?: ReactNode };

export function HomeSectionWindow({ root, facts, selectedKey, opened, children }: Props) {
  const navigate = useNavigate();
  const { code, words } = useLanguage();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(opened));
  const rows = treeRowsOf(root.entries, facts, expanded, { languageCode: code, workflows: words.homeWorkflows });
  const toggle = (key: string) =>
    setExpanded((was) => {
      const next = new Set(was);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const adds = addItemsOf(root.entries, facts, code);
  const choose = (key: string) => {
    const add = adds.find((item) => item.id === key);
    if (add) return navigate(stepPathOf(add.step), { state: addOriginOf(add, code) });
    const node = findNode(root.entries, key);
    if (!node) return;
    if (isSection(node)) return toggle(key);
    const from = { path: homeSectionPath(root.key), title: titleIn(root, code) };
    navigate(pathOfNode(node, facts, undefined), { state: { from } });
  };
  return (
    <Shell title={titleIn(root, code)} onBack={() => navigate(homePath())} backLabel={homeTab.label}>
      <div className="wf">
        <div className="wf-panes">
          <PaneTree label={titleIn(root, code)} rows={rows} selected={selectedKey} firstLevel={1} onChoose={choose} onToggle={toggle} />
          {children ?? <section className="wf-main" />}
        </div>
      </div>
    </Shell>
  );
}

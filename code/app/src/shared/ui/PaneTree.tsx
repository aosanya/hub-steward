import type { KeyboardEvent } from "react";
import { useLanguage } from "../language/language";
import { Icon, type IconName } from "./Icon";
import "./paneTree.css";

export type PaneTreeItem = { id: string; name: string; level: number; icon: IconName; expandable: boolean; open: boolean };

export type PaneTreeHeading = { heading: string };

export type PaneTreeRow = PaneTreeItem | PaneTreeHeading;

type Root = { name: string; selected: boolean; onChoose: () => void };

type Props = {
  label: string;
  rows: PaneTreeRow[];
  selected: string | null;
  onChoose: (id: string) => void;
  onToggle: (id: string) => void;
  root?: Root;
  firstLevel?: number;
};

const activate = (act: () => void) => (event: KeyboardEvent<HTMLElement>) => {
  if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  act();
};

const isHeading = (row: PaneTreeRow): row is PaneTreeHeading => "heading" in row;

export function PaneTree({ label, rows, selected, onChoose, onToggle, root, firstLevel = 2 }: Props) {
  const { words } = useLanguage();
  const named = (template: string, name: string) => template.replace("{name}", name);
  return (
    <div className="wf-tree" role="tree" aria-label={label}>
      {root ? (
        <div className="wf-row wf-root" role="treeitem" aria-level={1} aria-selected={root.selected} aria-label={root.name} tabIndex={0} onClick={root.onChoose} onKeyDown={activate(root.onChoose)}>
          {root.name}
        </div>
      ) : null}
      {rows.map((row) =>
        isHeading(row) ? (
          <div key={`heading:${row.heading}`} className="wf-group" role="presentation">
            {row.heading}
          </div>
        ) : (
          <div
            key={row.id}
            className="wf-row"
            role="treeitem"
            aria-level={row.level}
            aria-selected={selected === row.id}
            aria-expanded={row.expandable ? row.open : undefined}
            aria-label={row.name}
            tabIndex={0}
            style={{ ["--level" as string]: row.level - firstLevel }}
            onClick={() => onChoose(row.id)}
            onKeyDown={activate(() => onChoose(row.id))}
          >
            {row.expandable ? (
              <button
                type="button"
                className="wf-chevron"
                aria-label={named(row.open ? words.treeCollapse : words.treeExpand, row.name)}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggle(row.id);
                }}
              >
                <span aria-hidden="true">›</span>
              </button>
            ) : (
              <span className="wf-chevron" />
            )}
            {row.level > firstLevel ? <span className="wf-guide" aria-hidden="true" /> : null}
            <span className="wf-icon fi" aria-hidden="true">
              <Icon name={row.icon} />
            </span>
            <span className="wf-name">{row.name}</span>
          </div>
        ),
      )}
    </div>
  );
}

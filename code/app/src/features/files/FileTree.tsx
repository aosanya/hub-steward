import type { KeyboardEvent, ReactNode } from "react";
import { Icon } from "../../shared/ui/Icon";
import type { FolderEntry } from "./api";
import { entryIcon } from "./entryIcon";
import type { TreeRow } from "./treeRows";

type Props = {
  folderName: string;
  top?: ReactNode;
  rows: TreeRow[];
  selected: string | null;
  onFolder: () => void;
  onEntry: (entry: FolderEntry) => void;
  onToggle: (path: string) => void;
};

const activate = (act: () => void) => (event: KeyboardEvent<HTMLElement>) => {
  if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  act();
};

export function FileTree({ folderName, top, rows, selected, onFolder, onEntry, onToggle }: Props) {
  const choose = (entry: FolderEntry) => (entry.folder ? onToggle(entry.path) : onEntry(entry));
  return (
    <div className="wf-tree" role="tree" aria-label="Files">
      <div className="wf-row wf-root" role="treeitem" aria-level={1} aria-selected={selected === null} aria-label={folderName} tabIndex={0} onClick={onFolder} onKeyDown={activate(onFolder)}>
        {folderName}
      </div>
      {top}
      {rows.map(({ entry, level, open }) => (
        <div
          key={entry.path}
          className="wf-row"
          role="treeitem"
          aria-level={level}
          aria-selected={selected === entry.path}
          aria-expanded={entry.folder ? open : undefined}
          aria-label={entry.name}
          tabIndex={0}
          style={{ ["--level" as string]: level - 2 }}
          onClick={() => choose(entry)}
          onKeyDown={activate(() => choose(entry))}
        >
          {entry.folder ? (
            <button
              type="button"
              className="wf-chevron"
              aria-label={`${open ? "Collapse" : "Expand"} ${entry.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onToggle(entry.path);
              }}
            >
              <span aria-hidden="true">›</span>
            </button>
          ) : (
            <span className="wf-chevron" />
          )}
          {level > 2 ? <span className="wf-guide" aria-hidden="true" /> : null}
          <span className="wf-icon fi" aria-hidden="true">
            <Icon name={entryIcon(entry)} />
          </span>
          <span className="wf-name">{entry.name}</span>
        </div>
      ))}
    </div>
  );
}

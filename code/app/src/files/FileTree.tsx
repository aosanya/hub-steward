import type { KeyboardEvent } from "react";
import { Icon } from "../ui/Icon";
import type { FolderEntry } from "./api";
import { entryIcon } from "./entryIcon";
import type { TreeRow } from "./treeRows";

type Props = {
  folderName: string;
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

export function FileTree({ folderName, rows, selected, onFolder, onEntry, onToggle }: Props) {
  return (
    <div className="wf-tree" role="tree" aria-label="Files">
      <div className="wf-row wf-root" role="treeitem" aria-level={1} aria-selected={selected === null} aria-label={folderName} tabIndex={0} onClick={onFolder} onKeyDown={activate(onFolder)}>
        {folderName}
      </div>
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
          onClick={() => onEntry(entry)}
          onKeyDown={activate(() => onEntry(entry))}
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
          <span className="wf-icon" aria-hidden="true">
            <Icon name={entryIcon(entry)} />
          </span>
          <span className="wf-name">{entry.name}</span>
        </div>
      ))}
    </div>
  );
}

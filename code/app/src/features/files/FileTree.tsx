import { PaneTree, type PaneTreeItem } from "../../shared/ui/PaneTree";
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

const itemOf = ({ entry, level, open }: TreeRow): PaneTreeItem => ({ id: entry.path, name: entry.name, level, icon: entryIcon(entry), expandable: entry.folder, open });

export function FileTree({ folderName, rows, selected, onFolder, onEntry, onToggle }: Props) {
  const choose = (path: string) => {
    const found = rows.find(({ entry }) => entry.path === path)?.entry;
    if (!found) return;
    if (found.folder) onToggle(found.path);
    else onEntry(found);
  };
  return <PaneTree label="Files" root={{ name: folderName, selected: selected === null, onChoose: onFolder }} rows={rows.map(itemOf)} selected={selected} onChoose={choose} onToggle={onToggle} />;
}

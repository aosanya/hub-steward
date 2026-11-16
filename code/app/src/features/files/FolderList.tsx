import { useNavigate } from "react-router-dom";
import { Icon } from "../../shared/ui/Icon";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import type { Folder, FolderEntry } from "./api";
import { entryIcon } from "./entryIcon";
import { foldersFirst } from "./folderOrder";
import { filePath, folderPath } from "./paths";
import { formatSize } from "./viewer/formatSize";
import "./folderList.css";

type Props = { folder: Folder; entries: FolderEntry[] };

export function FolderList({ folder, entries }: Props) {
  const navigate = useNavigate();
  return (
    <Rows>
      {foldersFirst(entries).map((entry) => (
        <ListRow
          key={entry.path}
          title={entry.name}
          start={<span className="mark fi" aria-hidden="true"><Icon name={entryIcon(entry)} /></span>}
          end={entry.folder ? "›" : formatSize(entry.size)}
          onClick={() => navigate(entry.folder ? folderPath(folder.id, entry.path) : filePath(folder.id, entry.path))}
        />
      ))}
    </Rows>
  );
}

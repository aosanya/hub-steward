import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { agencyHomePath, openAgencyId } from "../agency/open";
import { useLoad } from "../forms/useLoad";
import { Icon } from "../ui/Icon";
import { ListRow, Rows } from "../ui/ListRow";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { Shell } from "../ui/Shell";
import { agoWords } from "./ago";
import type { FilesClient, Folder } from "./api";
import { folderPath } from "./paths";

type Props = { client: FilesClient };

function FolderRow({ folder }: { folder: Folder }) {
  const navigate = useNavigate();
  const when = agoWords(folder.changedAt);
  return (
    <ListRow
      title={folder.name}
      meta={when ? `Changed ${when}` : undefined}
      start={<span className="mark" aria-hidden="true"><Icon name="folder" /></span>}
      end="›"
      onClick={() => navigate(folderPath(folder.id))}
    />
  );
}

export function FoldersPage({ client }: Props) {
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const folders = useLoad(() => client.folders(), `folders:${openAgencyId()}:${attempt}`);
  return (
    <Shell title="Files" backLabel="Home" onBack={() => navigate(agencyHomePath(openAgencyId()))}>
      {folders.state === "loading" ? <LoadingLine /> : null}
      {folders.state === "error" ? <LoadFailed words="The Folders could not be loaded." onRetry={() => setAttempt(attempt + 1)} /> : null}
      {folders.state === "ready" && folders.data.length === 0 ? <EmptyCard words="No Folders yet" /> : null}
      {folders.state === "ready" && folders.data.length > 0 ? (
        <Rows>
          {folders.data.map((folder) => (
            <FolderRow key={folder.id} folder={folder} />
          ))}
        </Rows>
      ) : null}
    </Shell>
  );
}

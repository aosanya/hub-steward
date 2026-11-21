import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { agencyHomePath, openAgencyId } from "../../shared/wakala/openAgency";
import { useLoad } from "../../features/forms/useLoad";
import { Icon } from "../../shared/ui/Icon";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { Shell } from "../../app/Shell";
import { agoWords } from "./ago";
import type { FilesClient, Folder } from "./api";
import { folderPath } from "./paths";

type Props = { client: FilesClient };

const branchesWords = (count: number) => `${count} ${count === 1 ? "branch" : "branches"}`;

function FolderRow({ client, folder }: { client: FilesClient; folder: Folder }) {
  const navigate = useNavigate();
  const when = agoWords(folder.changedAt);
  const branches = useLoad(() => client.branches(folder), `folder-branches:${openAgencyId()}:${folder.id}`);
  const meta = [when ? `Changed ${when}` : "", branches.state === "ready" ? branchesWords(branches.data.length) : ""].filter(Boolean).join(" · ");
  return (
    <ListRow
      title={folder.name}
      meta={meta || undefined}
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
            <FolderRow key={folder.id} client={client} folder={folder} />
          ))}
        </Rows>
      ) : null}
    </Shell>
  );
}

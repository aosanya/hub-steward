import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { openAgencyId } from "../agency/open";
import { useLoad } from "../../features/forms/useLoad";
import { Button } from "../../shared/ui/Button";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { Shell } from "../../shared/ui/Shell";
import type { FilesClient, Folder, FolderEntry, Readme } from "./api";
import { FolderList } from "./FolderList";
import { backLabelFor, backPathFor, titleFor, topLevel } from "./folderTrail";
import { filesHomePath, pathParam } from "./paths";
import { MarkdownPage } from "./viewer/MarkdownPage";
import "./viewer/viewer.css";

type Opened = { status: "missing"; folder: Folder | null } | { status: "listed"; folder: Folder; entries: FolderEntry[]; readme: Readme | null };

const readmeAt = async (client: FilesClient, folder: Folder, path: string) => {
  if (path !== topLevel) return null;
  try {
    return await client.readme(folder, path);
  } catch {
    return null;
  }
};

const open = async (client: FilesClient, id: string, path: string): Promise<Opened> => {
  const folder = (await client.folders()).find((one) => one.id === id) ?? null;
  if (!folder) return { status: "missing", folder };
  const listing = await client.list(folder, path);
  if (listing.status === "missing") return { status: "missing", folder };
  return { status: "listed", folder, entries: listing.entries, readme: listing.entries.length > 0 ? await readmeAt(client, folder, path) : null };
};

export function FolderPage({ client }: { client: FilesClient }) {
  const navigate = useNavigate();
  const { folderId = "" } = useParams();
  const [params] = useSearchParams();
  const path = params.get(pathParam) ?? topLevel;
  const [attempt, setAttempt] = useState(0);
  const opened = useLoad(() => open(client, folderId, path), `folder:${openAgencyId()}:${folderId}:${path}:${attempt}`);
  const known = opened.state === "ready" ? opened.data.folder : null;
  const title = known ? titleFor(known.name, path) : "Files";
  const backLabel = known ? backLabelFor(known.name, path) : "Folders";
  const back = known ? backPathFor(known.id, path) : filesHomePath();
  return (
    <Shell title={title} backLabel={backLabel} onBack={() => navigate(back)}>
      {opened.state === "loading" ? <LoadingLine /> : null}
      {opened.state === "error" ? <LoadFailed words="The Folder could not be loaded." onRetry={() => setAttempt(attempt + 1)} /> : null}
      {opened.state === "ready" && opened.data.status === "missing" ? <EmptyCard words="Folder not found" /> : null}
      {opened.state === "ready" && opened.data.status === "listed" && opened.data.entries.length === 0 ? (
        <EmptyCard words="Nothing in this Folder yet">
          <p>Files that people or agents add to it show here.</p>
          <Button onClick={() => navigate(filesHomePath())}>Back to Folders</Button>
        </EmptyCard>
      ) : null}
      {opened.state === "ready" && opened.data.status === "listed" && opened.data.entries.length > 0 ? (
        <>
          <FolderList folder={opened.data.folder} entries={opened.data.entries} />
          {opened.data.readme ? (
            <div className="readme">
              <MarkdownPage source={opened.data.readme.content} />
            </div>
          ) : null}
        </>
      ) : null}
    </Shell>
  );
}

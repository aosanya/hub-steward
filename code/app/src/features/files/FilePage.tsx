import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { openAgencyId } from "../agency/open";
import { useLoad } from "../../features/forms/useLoad";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { Shell } from "../../shared/ui/Shell";
import type { FileAnswer, FilesClient, Folder } from "./api";
import { ChangedLine } from "./ChangedLine";
import { backLabelFor, lastNameOf, parentPathOf } from "./folderTrail";
import { filesHomePath, folderPath, pathParam } from "./paths";
import { FileViewer } from "./viewer/FileViewer";
import "./viewer/viewer.css";

type Opened = { folder: Folder | null; answer: FileAnswer };

const open = async (client: FilesClient, id: string, path: string): Promise<Opened> => {
  const folder = (await client.folders()).find((one) => one.id === id) ?? null;
  if (!folder) return { folder, answer: { status: "missing" } };
  return { folder, answer: await client.read(folder, path) };
};

export function FilePage({ client }: { client: FilesClient }) {
  const navigate = useNavigate();
  const { folderId = "" } = useParams();
  const [params] = useSearchParams();
  const path = params.get(pathParam) ?? "";
  const [attempt, setAttempt] = useState(0);
  const opened = useLoad(() => open(client, folderId, path), `file:${openAgencyId()}:${folderId}:${path}:${attempt}`);
  const folder = opened.state === "ready" ? opened.data.folder : null;
  const answer = opened.state === "ready" ? opened.data.answer : null;
  const back = folder ? folderPath(folder.id, parentPathOf(path)) : filesHomePath();
  return (
    <Shell title={lastNameOf(path) || "File"} backLabel={folder ? backLabelFor(folder.name, path) : "Folders"} onBack={() => navigate(back)}>
      {opened.state === "loading" ? <LoadingLine /> : null}
      {opened.state === "error" ? <LoadFailed words="The file could not be loaded." onRetry={() => setAttempt(attempt + 1)} /> : null}
      {answer?.status === "missing" ? <EmptyCard words={folder ? "File not found" : "Folder not found"} /> : null}
      {folder && answer && answer.status !== "missing" ? (
        <>
          <ChangedLine client={client} folder={folder} path={path} />
          <FileViewer
            name={answer.name}
            extension={answer.status === "withheld" ? "" : answer.extension}
            text={answer.status === "text" ? answer.content : null}
            size={answer.size}
            bytes={answer.status === "image" ? answer.bytes : null}
            reason={answer.status === "withheld" ? answer.reason : undefined}
          />
        </>
      ) : null}
    </Shell>
  );
}

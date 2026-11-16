import { useState } from "react";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { useLoad } from "../../features/forms/useLoad";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import type { FilesClient, Folder } from "./api";
import { extensionOf } from "./fileKind";
import { FileViewer } from "./viewer/FileViewer";
import "./viewer/viewer.css";

export const noDescriptionWords = "No description yet";

type Props = { client: FilesClient; folder: Folder; path: string };

export function Description({ client, folder, path, empty }: Props & { empty: boolean }) {
  const readme = useLoad(async () => {
    if (empty) return null;
    try {
      return await client.readme(folder, path);
    } catch {
      return null;
    }
  }, `description:${openAgencyId()}:${folder.id}:${path}:${empty}`);
  if (readme.state === "loading") return <LoadingLine />;
  if (readme.state === "error" || !readme.data) return <p className="wf-note">{noDescriptionWords}</p>;
  const { name, content } = readme.data;
  return (
    <div className="wf-doc">
      <FileViewer name={name} extension={extensionOf(name)} text={content} size={content.length} />
    </div>
  );
}

export function FileContent({ client, folder, path }: Props) {
  const [attempt, setAttempt] = useState(0);
  const file = useLoad(() => client.read(folder, path), `file:${openAgencyId()}:${folder.id}:${path}:${attempt}`);
  if (file.state === "loading") return <LoadingLine />;
  if (file.state === "error") return <LoadFailed words="The file could not be loaded." onRetry={() => setAttempt(attempt + 1)} />;
  const answer = file.data;
  if (answer.status === "missing") return <EmptyCard words="File not found" />;
  if (answer.status === "image") {
    return (
      <div className="wf-doc">
        <FileViewer name={answer.name} extension={answer.extension} text={null} size={answer.size} bytes={answer.bytes} />
      </div>
    );
  }
  if (answer.status === "withheld") {
    return (
      <div className="wf-doc">
        <FileViewer name={answer.name} extension={extensionOf(answer.name)} text={null} size={answer.size} reason={answer.reason} />
      </div>
    );
  }
  return (
    <div className="wf-doc">
      <FileViewer name={answer.name} extension={answer.extension} text={answer.content} size={answer.size} />
    </div>
  );
}

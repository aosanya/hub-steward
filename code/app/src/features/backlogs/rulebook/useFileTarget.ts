import { openAgencyId } from "../../../shared/wakala/openAgency";
import { filePath, mcpFilesClient, type FilesClient } from "../../files";
import { useLoad } from "../../forms/useLoad";
import type { RuleFile } from "./types";

export type FileTarget = (file: RuleFile) => string | undefined;

export function useFileTarget(filesClient: Pick<FilesClient, "folders"> = mcpFilesClient, needed = true): FileTarget {
  const folders = useLoad(() => (needed ? filesClient.folders() : Promise.resolve([])), `file-folders:${openAgencyId()}:${needed}`);
  const known = folders.state === "ready" ? folders.data : [];
  return (file) => {
    const folder = file.missing ? undefined : known.find((candidate) => candidate.name === file.repo);
    return folder ? filePath(folder.id, file.path) : undefined;
  };
}

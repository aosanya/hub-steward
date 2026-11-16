import { openAgencyId } from "../../shared/wakala/openAgency";
import { useLoad } from "../../features/forms/useLoad";
import { agoWords } from "./ago";
import type { FilesClient, Folder } from "./api";
import "./changedLine.css";

export function ChangedLine({ client, folder, path }: { client: FilesClient; folder: Folder; path: string }) {
  const changed = useLoad(() => client.changed(folder, path), `file-changed:${openAgencyId()}:${folder.id}:${path}`);
  if (changed.state !== "ready" || !changed.data) return null;
  return <p className="changed-line">{`Changed ${agoWords(changed.data.when)} by ${changed.data.author}`}</p>;
}

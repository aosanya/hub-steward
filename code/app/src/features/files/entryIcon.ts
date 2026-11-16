import type { IconName } from "../../shared/ui/Icon";
import type { FolderEntry } from "./api";
import { viewerFor } from "./viewer/viewerFor";

const byViewer: Record<ReturnType<typeof viewerFor>, IconName> = {
  code: "code",
  markdown: "document",
  text: "file",
  image: "file",
  none: "file",
};

export const entryIcon = (entry: Pick<FolderEntry, "name" | "folder">): IconName => (entry.folder ? "folder" : byViewer[viewerFor(entry.name)]);

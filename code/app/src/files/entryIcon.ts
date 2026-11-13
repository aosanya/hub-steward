import type { IconName } from "../ui/Icon";
import type { FolderEntry } from "./api";
import { viewerFor } from "./viewer/viewerFor";

const byViewer: Record<ReturnType<typeof viewerFor>, IconName> = {
  code: "code",
  markdown: "document",
  text: "file",
  image: "file",
  none: "file",
};

export const entryIcon = (entry: FolderEntry): IconName => (entry.folder ? "folder" : byViewer[viewerFor(entry.name)]);

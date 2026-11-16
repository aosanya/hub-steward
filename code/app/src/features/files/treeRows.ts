import type { FolderEntry } from "./api";
import { foldersFirst } from "./folderOrder";
import { topLevel } from "./folderTrail";

export type TreeRow = { entry: FolderEntry; level: number; open: boolean };

export const firstLevel = 2;

export const treeRows = (listed: Record<string, FolderEntry[]>, expanded: ReadonlySet<string>, path = topLevel, level = firstLevel): TreeRow[] =>
  foldersFirst(listed[path] ?? []).flatMap((entry) => {
    const open = entry.folder && expanded.has(entry.path);
    return [{ entry, level, open }, ...(open ? treeRows(listed, expanded, entry.path, level + 1) : [])];
  });

export const ancestorsOf = (path: string): string[] =>
  path
    .split("/")
    .slice(0, -1)
    .map((_, index, parts) => parts.slice(0, index + 1).join("/"));

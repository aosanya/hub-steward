import type { FolderEntry } from "./api";

const byName = (a: FolderEntry, b: FolderEntry): number => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

export const foldersFirst = (entries: FolderEntry[]): FolderEntry[] => {
  const sorted = [...entries].sort(byName);
  return [...sorted.filter((one) => one.folder), ...sorted.filter((one) => !one.folder)];
};

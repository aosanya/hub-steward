import type { FolderEntry } from "./api";

export const foldersFirst = (entries: FolderEntry[]): FolderEntry[] => [...entries.filter((one) => one.folder), ...entries.filter((one) => !one.folder)];

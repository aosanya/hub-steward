import { hasModule, mcpAgencyClient } from "../agency/modules";
import { itemsOf } from "../backlogs";
import { McpError, callTool } from "../../shared/wakala/mcp";
import { extensionOf } from "./fileKind";
import { viewerFor } from "./viewer/viewerFor";

export const filesTools = {
  repos: "forms_git_repository_list",
  directory: "forms_git_directory_list",
  file: "forms_git_file_read",
  log: "forms_git_commit_log",
};

export const fileSizeLimit = 1048576;

export const gitModule = "git";

export type Folder = { id: string; name: string; branchId: string; changedAt: string };

export type FolderEntry = { name: string; path: string; folder: boolean; size: number };

export type Listing = { status: "listed"; entries: FolderEntry[] } | { status: "missing" };

export type FileAnswer =
  | { status: "text"; name: string; path: string; extension: string; size: number; content: string }
  | { status: "image"; name: string; path: string; extension: string; size: number; bytes: Uint8Array }
  | { status: "withheld"; name: string; path: string; size: number; reason: "too large" | "not text" }
  | { status: "missing" };

export type Readme = { name: string; path: string; content: string };

export type Changed = { when: string; author: string };

export type FilesClient = {
  mounted: () => Promise<boolean>;
  folders: () => Promise<Folder[]>;
  list: (folder: Folder, path: string) => Promise<Listing>;
  read: (folder: Folder, path: string) => Promise<FileAnswer>;
  readme: (folder: Folder, path: string) => Promise<Readme | null>;
  changed: (folder: Folder, path: string) => Promise<Changed | null>;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

const readmeName = /^readme(\.[^.]+)?$/i;

const isNotFound = (error: unknown) => error instanceof McpError && error.message.toLowerCase().includes("not found");

export const folderOf = (raw: any): Folder => ({
  id: text(raw?.id),
  name: text(raw?.name),
  branchId: text(raw?.default_branch_id),
  changedAt: text(raw?.last_commit_at),
});

export const entryOf = (raw: any): FolderEntry => ({
  name: text(raw?.name),
  path: text(raw?.path) || text(raw?.name),
  folder: raw?.is_dir === true,
  size: typeof raw?.size === "number" ? raw.size : 0,
});

const bytesOfBase64 = (encoded: string) => Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));

const imageBytes = (encoding: string, content: string) =>
  encoding === "base64" ? bytesOfBase64(content) : new TextEncoder().encode(content);

const parentOf = (path: string) => path.slice(0, Math.max(path.lastIndexOf("/"), 0));

const list = async (folder: Folder, path: string): Promise<Listing> => {
  try {
    const reply = await callTool("", filesTools.directory, { branchID: folder.branchId, path });
    return { status: "listed", entries: itemsOf(reply).map(entryOf) };
  } catch (error) {
    if (isNotFound(error)) return { status: "missing" };
    throw error;
  }
};

const read = async (folder: Folder, path: string): Promise<FileAnswer> => {
  const parent = await list(folder, parentOf(path));
  if (parent.status === "missing") return { status: "missing" };
  const entry = parent.entries.find((one) => one.path === path && !one.folder);
  if (!entry) return { status: "missing" };
  const { name, size } = entry;
  if (size > fileSizeLimit) return { status: "withheld", name, path, size, reason: "too large" };
  try {
    const blob = await callTool("", filesTools.file, { branchID: folder.branchId, path });
    const encoding = text(blob?.encoding);
    const extension = text(blob?.extension) || extensionOf(name);
    if (viewerFor(name, extension) === "image") {
      return { status: "image", name, path, extension, size, bytes: imageBytes(encoding, text(blob?.content)) };
    }
    if (encoding !== "utf-8") return { status: "withheld", name, path, size, reason: "not text" };
    return { status: "text", name, path, extension, size, content: text(blob?.content) };
  } catch (error) {
    if (isNotFound(error)) return { status: "missing" };
    throw error;
  }
};

export const mcpFilesClient: FilesClient = {
  async mounted() {
    try {
      return hasModule(await mcpAgencyClient.read(), gitModule);
    } catch {
      return false;
    }
  },
  async folders() {
    return itemsOf(await callTool("", filesTools.repos, {}))
      .map(folderOf)
      .filter((one) => one.name !== "" && one.branchId !== "");
  },
  list,
  read,
  async readme(folder, path) {
    const listing = await list(folder, path);
    if (listing.status === "missing") return null;
    const entry = listing.entries.find((one) => !one.folder && readmeName.test(one.name));
    if (!entry) return null;
    const answer = await read(folder, entry.path);
    return answer.status === "text" ? { name: answer.name, path: answer.path, content: answer.content } : null;
  },
  async changed(folder, path) {
    try {
      const [latest] = itemsOf(await callTool("", filesTools.log, { branchID: folder.branchId, path, limit: 1 }));
      return latest ? { when: text(latest.timestamp), author: text(latest.author) } : null;
    } catch {
      return null;
    }
  },
};

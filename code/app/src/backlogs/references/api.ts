import { callTool } from "../../wakala/mcp";
import { itemsOf, taskTools } from "../api";

export const referenceTools = {
  list: "taskmanager_task_reference_list",
  add: "taskmanager_task_reference_add",
  remove: "taskmanager_task_reference_remove",
  confirm: "taskmanager_task_reference_confirm",
  repos: "forms_git_repository_list",
  directory: "forms_git_directory_list",
};

export type ReferenceKind = "file" | "folder" | "issue" | "screen" | "link";

export const kindWords: Record<ReferenceKind, string> = {
  file: "File",
  folder: "Folder",
  issue: "Board row",
  screen: "Screen or tool",
  link: "Link",
};

export type Reference = { id: string; kind: ReferenceKind; repo: string; target: string; source: "person" | "assistant"; confirmed: boolean };

export type RepoEntry = { name: string; path: string; folder: boolean };

export type ReferencesClient = {
  list: (issueId: string) => Promise<Reference[]>;
  add: (issueId: string, kind: ReferenceKind, repo: string, target: string) => Promise<Reference>;
  remove: (issueId: string, id: string) => Promise<void>;
  confirm: (issueId: string, id: string) => Promise<void>;
  findIssue: (code: string) => Promise<string | null>;
};

export type RepoClient = {
  repos: () => Promise<string[]>;
  entries: (repo: string, path: string) => Promise<RepoEntry[] | null>;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

const kinds = Object.keys(kindWords) as ReferenceKind[];

export const referenceOf = (raw: any): Reference => ({
  id: text(raw?.id),
  kind: kinds.find((kind) => kind === raw?.kind) ?? "link",
  repo: text(raw?.repo),
  target: text(raw?.target),
  source: raw?.source === "assistant" ? "assistant" : "person",
  confirmed: raw?.confirmed === true,
});

export const entryOf = (raw: any): RepoEntry => ({ name: text(raw?.name), path: text(raw?.path) || text(raw?.name), folder: raw?.is_dir === true });

export const mcpReferencesClient: ReferencesClient = {
  async list(issueId) {
    return itemsOf(await callTool("", referenceTools.list, { taskID: issueId })).map(referenceOf);
  },
  async add(issueId, kind, repo, target) {
    return referenceOf(await callTool("", referenceTools.add, { taskID: issueId, kind, ...(repo ? { repo } : {}), target }));
  },
  async remove(issueId, id) {
    await callTool("", referenceTools.remove, { taskID: issueId, referenceID: id });
  },
  async confirm(issueId, id) {
    await callTool("", referenceTools.confirm, { taskID: issueId, referenceID: id });
  },
  async findIssue(code) {
    const found = itemsOf(await callTool("", taskTools.pending, { q: code, limit: 5 })).find((raw) => text(raw?.code).toLowerCase() === code.toLowerCase() || text(raw?.id) === code);
    return found ? text(found.id) : null;
  },
};

type CatalogRepo = { name: string; mainBranchId: string };

const catalog = async (): Promise<CatalogRepo[]> =>
  itemsOf(await callTool("", referenceTools.repos, {}))
    .map((raw) => ({ name: text(raw?.name), mainBranchId: text(raw?.default_branch_id) }))
    .filter((one) => one.name !== "");

export const mcpRepoClient: RepoClient = {
  async repos() {
    try {
      return (await catalog()).map((one) => one.name);
    } catch {
      return [];
    }
  },
  async entries(repo, path) {
    try {
      const found = (await catalog()).find((one) => one.name === repo);
      if (!found || found.mainBranchId === "") return null;
      return itemsOf(await callTool("", referenceTools.directory, { branchID: found.mainBranchId, path })).map(entryOf);
    } catch {
      return null;
    }
  },
};

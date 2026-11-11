import type { Reference, RepoClient } from "./api";

const parts = (path: string) => path.split("/").filter((part) => part !== "" && part !== ".");

export const parentOf = (path: string) => parts(path).slice(0, -1).join("/");

export const nameOf = (path: string) => parts(path).slice(-1)[0] ?? "";

export const joinPath = (folder: string, name: string) => [...parts(folder), name].join("/");

const inRepo = (one: Reference) => one.kind === "file" || one.kind === "folder";

export const missingOf = async (held: Reference[], repos: RepoClient): Promise<Set<string>> => {
  const checked = held.filter(inRepo);
  const folders = [...new Set(checked.map((one) => `${one.repo}\n${parentOf(one.target)}`))];
  const listed = new Map(await Promise.all(folders.map(async (key) => [key, await repos.entries(...(key.split("\n") as [string, string]))] as const)));
  return new Set(
    checked
      .filter((one) => {
        const entries = listed.get(`${one.repo}\n${parentOf(one.target)}`);
        return entries !== null && entries !== undefined && !entries.some((entry) => entry.name === nameOf(one.target) && entry.folder === (one.kind === "folder"));
      })
      .map((one) => one.id),
  );
};

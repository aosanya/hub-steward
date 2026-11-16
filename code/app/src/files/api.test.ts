import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../shared/wakala/mcp";
import { fileSizeLimit, filesTools, mcpFilesClient } from "./api";

afterEach(() => vi.restoreAllMocks());

type Row = { name: string; path: string; is_dir: boolean; size: number };
type Blob = { extension?: string; encoding?: string; content?: string };

const dir = (name: string, path: string): Row => ({ name, path, is_dir: true, size: 0 });
const file = (name: string, path: string, size: number): Row => ({ name, path, is_dir: false, size });

const folder = { id: "r1", name: "Field notes", branchId: "b1", changedAt: "" };

type Hub = {
  dirs?: Record<string, Row[]>;
  blobs?: Record<string, Blob>;
  repos?: unknown[];
  log?: unknown[];
  mounts?: unknown;
  agency?: unknown;
  failing?: string[];
  thrown?: Record<string, Error>;
};

const notFound = (tool: string) => new mcp.McpError(`${tool}: not found`);

const hub = (state: Hub = {}) => {
  const seen: string[] = [];
  const spy = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string, args: any) => {
    seen.push(tool);
    if (state.failing?.includes(tool)) throw new mcp.McpError(`${tool}: down`);
    if (state.thrown?.[tool]) throw state.thrown[tool];
    if (tool === "agency_get_agency") return (state.agency ?? { name: "Siaya" }) as never;
    if (tool === "agency_list_mounts") return (state.mounts ?? { modules: [{ module: "git", mounts: [{ name: "Files", key: "files" }] }] }) as never;
    if (tool === filesTools.repos) return { items: state.repos ?? [] } as never;
    if (tool === filesTools.directory) {
      const rows = state.dirs?.[args.path];
      if (!rows) throw notFound(tool);
      return { items: rows } as never;
    }
    if (tool === filesTools.file) {
      const row = Object.values(state.dirs ?? {}).flat().find((entry) => entry.path === args.path);
      const blob = state.blobs?.[args.path];
      if (!row || !blob) throw notFound(tool);
      return {
        id: `f-${args.path}`,
        sha: "abc123",
        path: args.path,
        name: row.name,
        extension: blob.extension ?? "",
        size: row.size,
        encoding: blob.encoding ?? "utf-8",
        content: blob.content ?? "",
      } as never;
    }
    if (tool === filesTools.log) return { items: state.log ?? [] } as never;
    throw new Error(`unexpected tool ${tool}`);
  });
  return { spy, seen };
};

const called = (spy: ReturnType<typeof hub>["spy"], tool: string) => spy.mock.calls.filter((call) => call[1] === tool);

describe("files tools", () => {
  it("names the four read tools of the git module and the size limit of one megabyte", () => {
    expect(filesTools).toEqual({
      repos: "forms_git_repository_list",
      directory: "forms_git_directory_list",
      file: "forms_git_file_read",
      log: "forms_git_commit_log",
    });
    expect(fileSizeLimit).toBe(1048576);
  });
});

describe("whether the agency has files", () => {
  it("is true when the git module is mounted, read through agency_get_agency and agency_list_mounts", async () => {
    const { spy } = hub();
    expect(await mcpFilesClient.mounted()).toBe(true);
    expect(spy).toHaveBeenCalledWith("", "agency_get_agency", {});
    expect(spy).toHaveBeenCalledWith("", "agency_list_mounts", {});
    expect(spy).not.toHaveBeenCalledWith("", "agency_list_modules", expect.anything());
  });

  it("is false when the git module is not among the mounted modules", async () => {
    hub({ mounts: { modules: [{ module: "market", mounts: [{ name: "Market", key: "market" }] }] } });
    expect(await mcpFilesClient.mounted()).toBe(false);
  });

  it("is false when no module is mounted at all", async () => {
    hub({ mounts: { modules: [] } });
    expect(await mcpFilesClient.mounted()).toBe(false);
  });

  it("is false, not an error, when the mounts read fails", async () => {
    hub({ failing: ["agency_list_mounts"] });
    expect(await mcpFilesClient.mounted()).toBe(false);
  });

  it("is false, not an error, when the mounts reply cannot be read", async () => {
    hub({ mounts: {} });
    expect(await mcpFilesClient.mounted()).toBe(false);
  });

  it("is false, not an error, when both reads fail", async () => {
    hub({ failing: ["agency_get_agency", "agency_list_mounts"] });
    expect(await mcpFilesClient.mounted()).toBe(false);
  });
});

describe("the list of folders", () => {
  it("maps each repository to a folder with its default branch, through the read tool only", async () => {
    const { spy } = hub({
      repos: [
        { id: "r1", name: "Field notes", default_branch: "main", default_branch_id: "b1", last_commit_at: "2026-11-13T10:00:00Z" },
        { id: "r2", name: "Minutes", default_branch: "trunk", default_branch_id: "b2" },
      ],
    });
    expect(await mcpFilesClient.folders()).toEqual([
      { id: "r1", name: "Field notes", branchId: "b1", changedAt: "2026-11-13T10:00:00Z" },
      { id: "r2", name: "Minutes", branchId: "b2", changedAt: "" },
    ]);
    expect(spy.mock.calls.map((call) => call[1])).toEqual(["forms_git_repository_list"]);
  });

  it("drops a repository with no name or no default branch", async () => {
    hub({
      repos: [
        { id: "r1", name: "Field notes", default_branch: "main", default_branch_id: "b1" },
        { id: "r2", name: "", default_branch: "main", default_branch_id: "b2" },
        { id: "r3", name: "Empty", default_branch: "", default_branch_id: "" },
        { id: "r4", default_branch_id: "b4" },
      ],
    });
    expect(await mcpFilesClient.folders()).toEqual([{ id: "r1", name: "Field notes", branchId: "b1", changedAt: "" }]);
  });

  it("gives an empty list when the hub has no repository", async () => {
    hub({ repos: [] });
    expect(await mcpFilesClient.folders()).toEqual([]);
  });
});

describe("a folder's listing", () => {
  it("asks the directory of the branch and gives each entry as a folder or a file with its size", async () => {
    const { spy } = hub({ dirs: { "": [dir("src", "src"), file("notes.txt", "notes.txt", 120)] } });
    expect(await mcpFilesClient.list(folder, "")).toEqual({
      status: "listed",
      entries: [
        { name: "src", path: "src", folder: true, size: 0 },
        { name: "notes.txt", path: "notes.txt", folder: false, size: 120 },
      ],
    });
    expect(spy).toHaveBeenCalledWith("", "forms_git_directory_list", { branchID: "b1", path: "" });
  });

  it("lists an empty folder with no entries", async () => {
    hub({ dirs: { "": [] } });
    expect(await mcpFilesClient.list(folder, "")).toEqual({ status: "listed", entries: [] });
  });

  it("lists a folder inside a folder by its path and marks the folders among its rows", async () => {
    const { spy } = hub({ dirs: { "src/app": [dir("pages", "src/app/pages"), file("main.ts", "src/app/main.ts", 40)] } });
    const listing = await mcpFilesClient.list(folder, "src/app");
    expect(spy).toHaveBeenCalledWith("", "forms_git_directory_list", { branchID: "b1", path: "src/app" });
    expect(listing).toEqual({
      status: "listed",
      entries: [
        { name: "pages", path: "src/app/pages", folder: true, size: 0 },
        { name: "main.ts", path: "src/app/main.ts", folder: false, size: 40 },
      ],
    });
  });

  it("answers missing when the hub says the path was not found", async () => {
    hub({ dirs: {} });
    expect(await mcpFilesClient.list(folder, "gone")).toEqual({ status: "missing" });
  });

  it("rethrows an error that is not a not-found answer", async () => {
    hub({ thrown: { forms_git_directory_list: new mcp.McpError("forms_git_directory_list: not allowed") } });
    await expect(mcpFilesClient.list(folder, "")).rejects.toThrow("not allowed");
  });
});

describe("reading a file", () => {
  it("gives the text of a text file with its name, path, extension and size", async () => {
    const { spy } = hub({
      dirs: { docs: [file("plan.md", "docs/plan.md", 11)] },
      blobs: { "docs/plan.md": { extension: "md", content: "# The plan\n" } },
    });
    expect(await mcpFilesClient.read(folder, "docs/plan.md")).toEqual({
      status: "text",
      name: "plan.md",
      path: "docs/plan.md",
      extension: "md",
      size: 11,
      content: "# The plan\n",
    });
    expect(spy).toHaveBeenCalledWith("", "forms_git_directory_list", { branchID: "b1", path: "docs" });
    expect(spy).toHaveBeenCalledWith("", "forms_git_file_read", { branchID: "b1", path: "docs/plan.md" });
  });

  it("reads a file at the top of the folder through the listing of the root", async () => {
    const { spy } = hub({
      dirs: { "": [file("notes.txt", "notes.txt", 5)] },
      blobs: { "notes.txt": { extension: "txt", content: "hello" } },
    });
    const answer = await mcpFilesClient.read(folder, "notes.txt");
    expect(answer).toMatchObject({ status: "text", content: "hello" });
    expect(spy).toHaveBeenCalledWith("", "forms_git_directory_list", { branchID: "b1", path: "" });
  });

  it("withholds a file over the size limit without reading it", async () => {
    const { spy } = hub({
      dirs: { "": [file("big.log", "big.log", fileSizeLimit + 1)] },
      blobs: { "big.log": { extension: "log", content: "x" } },
    });
    expect(await mcpFilesClient.read(folder, "big.log")).toEqual({
      status: "withheld",
      name: "big.log",
      path: "big.log",
      size: fileSizeLimit + 1,
      reason: "too large",
    });
    expect(called(spy, "forms_git_file_read")).toHaveLength(0);
  });

  it("reads a file of exactly the size limit", async () => {
    const { spy } = hub({
      dirs: { "": [file("edge.txt", "edge.txt", fileSizeLimit)] },
      blobs: { "edge.txt": { extension: "txt", content: "edge" } },
    });
    expect(await mcpFilesClient.read(folder, "edge.txt")).toMatchObject({ status: "text", size: fileSizeLimit, content: "edge" });
    expect(called(spy, "forms_git_file_read")).toHaveLength(1);
  });

  it("withholds a binary that is not an image, with no content", async () => {
    hub({
      dirs: { "": [file("data.bin", "data.bin", 2048)] },
      blobs: { "data.bin": { extension: "bin", encoding: "base64", content: "iVBORw0KGgo=" } },
    });
    const answer = await mcpFilesClient.read(folder, "data.bin");
    expect(answer).toEqual({ status: "withheld", name: "data.bin", path: "data.bin", size: 2048, reason: "not text" });
    expect(answer).not.toHaveProperty("content");
  });

  it("decodes the base64 of a png into its bytes", async () => {
    hub({
      dirs: { "": [file("photo.png", "photo.png", 8)] },
      blobs: { "photo.png": { extension: "png", encoding: "base64", content: "iVBORw0KGgo=" } },
    });
    const answer = await mcpFilesClient.read(folder, "photo.png");
    expect(answer).toMatchObject({ status: "image", name: "photo.png", path: "photo.png", extension: "png", size: 8 });
    expect(answer).not.toHaveProperty("content");
    expect(answer.status === "image" ? Array.from(answer.bytes) : []).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it("gives a jpg, a gif and a webp as images too", async () => {
    hub({
      dirs: { "": [file("a.jpg", "a.jpg", 3), file("b.gif", "b.gif", 3), file("c.webp", "c.webp", 3)] },
      blobs: {
        "a.jpg": { extension: "jpg", encoding: "base64", content: "AAEC" },
        "b.gif": { extension: "gif", encoding: "base64", content: "AAEC" },
        "c.webp": { extension: "webp", encoding: "base64", content: "AAEC" },
      },
    });
    for (const path of ["a.jpg", "b.gif", "c.webp"]) {
      expect(await mcpFilesClient.read(folder, path)).toMatchObject({ status: "image", path });
    }
  });

  it("gives an svg, which the hub sends as utf-8 text, as image bytes and never as text", async () => {
    const markup = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    hub({
      dirs: { "": [file("logo.svg", "logo.svg", markup.length)] },
      blobs: { "logo.svg": { extension: "svg", encoding: "utf-8", content: markup } },
    });
    const answer = await mcpFilesClient.read(folder, "logo.svg");
    expect(answer).toMatchObject({ status: "image", extension: "svg" });
    expect(answer).not.toHaveProperty("content");
    expect(answer.status === "image" ? new TextDecoder().decode(answer.bytes) : "").toBe(markup);
  });

  it("takes the extension from the name when the hub sends none", async () => {
    hub({
      dirs: { "": [file("photo.png", "photo.png", 3)] },
      blobs: { "photo.png": { encoding: "base64", content: "AAEC" } },
    });
    expect(await mcpFilesClient.read(folder, "photo.png")).toMatchObject({ status: "image", extension: "png" });
  });

  it("withholds an image over the size limit without reading it", async () => {
    const { spy } = hub({
      dirs: { "": [file("huge.png", "huge.png", fileSizeLimit + 1)] },
      blobs: { "huge.png": { extension: "png", encoding: "base64", content: "AAEC" } },
    });
    expect(await mcpFilesClient.read(folder, "huge.png")).toEqual({
      status: "withheld",
      name: "huge.png",
      path: "huge.png",
      size: fileSizeLimit + 1,
      reason: "too large",
    });
    expect(called(spy, "forms_git_file_read")).toHaveLength(0);
  });

  it("answers missing when the path is not in the listing of its folder", async () => {
    const { spy } = hub({ dirs: { "": [file("notes.txt", "notes.txt", 5)] }, blobs: { "notes.txt": { content: "hello" } } });
    expect(await mcpFilesClient.read(folder, "other.txt")).toEqual({ status: "missing" });
    expect(called(spy, "forms_git_file_read")).toHaveLength(0);
  });

  it("answers missing when the path is a folder", async () => {
    const { spy } = hub({ dirs: { "": [dir("src", "src")], src: [] } });
    expect(await mcpFilesClient.read(folder, "src")).toEqual({ status: "missing" });
    expect(called(spy, "forms_git_file_read")).toHaveLength(0);
  });

  it("answers missing when the parent folder is missing", async () => {
    hub({ dirs: {} });
    expect(await mcpFilesClient.read(folder, "gone/notes.txt")).toEqual({ status: "missing" });
  });

  it("answers missing when the hub says the file was not found on the read", async () => {
    hub({ dirs: { "": [file("notes.txt", "notes.txt", 5)] }, thrown: { forms_git_file_read: notFound("forms_git_file_read") } });
    expect(await mcpFilesClient.read(folder, "notes.txt")).toEqual({ status: "missing" });
  });

  it("rethrows an error from the read that is not a not-found answer", async () => {
    hub({
      dirs: { "": [file("notes.txt", "notes.txt", 5)] },
      thrown: { forms_git_file_read: new mcp.McpError("forms_git_file_read: not allowed") },
    });
    await expect(mcpFilesClient.read(folder, "notes.txt")).rejects.toThrow("not allowed");
  });
});

describe("the readme of a folder", () => {
  const readmeHub = (rows: Row[], blobs: Record<string, Blob>) => hub({ dirs: { "": rows }, blobs });

  it("finds README among other files and gives its name, path and text", async () => {
    readmeHub(
      [file("notes.txt", "notes.txt", 3), file("README", "README", 8)],
      { README: { content: "Welcome." }, "notes.txt": { content: "abc" } },
    );
    expect(await mcpFilesClient.readme(folder, "")).toEqual({ name: "README", path: "README", content: "Welcome." });
  });

  it("finds readme.md and Readme.MD whatever the case", async () => {
    readmeHub([file("readme.md", "readme.md", 4)], { "readme.md": { extension: "md", content: "low!" } });
    expect(await mcpFilesClient.readme(folder, "")).toEqual({ name: "readme.md", path: "readme.md", content: "low!" });
    readmeHub([file("Readme.MD", "Readme.MD", 4)], { "Readme.MD": { extension: "MD", content: "mix!" } });
    expect(await mcpFilesClient.readme(folder, "")).toEqual({ name: "Readme.MD", path: "Readme.MD", content: "mix!" });
  });

  it("finds the readme of a folder inside a folder", async () => {
    hub({ dirs: { docs: [file("README.md", "docs/README.md", 6)] }, blobs: { "docs/README.md": { extension: "md", content: "Docs." } } });
    expect(await mcpFilesClient.readme(folder, "docs")).toEqual({ name: "README.md", path: "docs/README.md", content: "Docs." });
  });

  it("does not take READMEFIRST.txt for a readme", async () => {
    const { spy } = readmeHub([file("READMEFIRST.txt", "READMEFIRST.txt", 5)], { "READMEFIRST.txt": { extension: "txt", content: "first" } });
    expect(await mcpFilesClient.readme(folder, "")).toBeNull();
    expect(called(spy, "forms_git_file_read")).toHaveLength(0);
  });

  it("does not take a folder named README for a readme", async () => {
    readmeHub([dir("README", "README")], {});
    expect(await mcpFilesClient.readme(folder, "")).toBeNull();
  });

  it("gives nothing when the folder has no readme", async () => {
    readmeHub([file("notes.txt", "notes.txt", 3)], { "notes.txt": { content: "abc" } });
    expect(await mcpFilesClient.readme(folder, "")).toBeNull();
  });

  it("gives nothing when the readme is withheld for its size", async () => {
    readmeHub([file("README.md", "README.md", fileSizeLimit + 1)], { "README.md": { extension: "md", content: "huge" } });
    expect(await mcpFilesClient.readme(folder, "")).toBeNull();
  });

  it("gives nothing when the readme is not text", async () => {
    readmeHub([file("README", "README", 4)], { README: { encoding: "base64", content: "AAEC" } });
    expect(await mcpFilesClient.readme(folder, "")).toBeNull();
  });

  it("gives nothing when the folder is missing", async () => {
    hub({ dirs: {} });
    expect(await mcpFilesClient.readme(folder, "gone")).toBeNull();
  });
});

describe("when a folder or file last changed", () => {
  const log = [
    { sha: "c2", author: "Amina", message: "Fix the plan", timestamp: "2026-11-12T09:30:00Z" },
    { sha: "c1", author: "Juma", message: "First draft", timestamp: "2026-11-01T08:00:00Z" },
  ];

  it("gives the time and author of the first commit and asks the log for one commit of the path", async () => {
    const { spy } = hub({ log });
    expect(await mcpFilesClient.changed(folder, "docs/plan.md")).toEqual({ when: "2026-11-12T09:30:00Z", author: "Amina" });
    expect(spy).toHaveBeenCalledWith("", "forms_git_commit_log", { branchID: "b1", path: "docs/plan.md", limit: 1 });
  });

  it("asks the log with an empty path for the line of the folder itself", async () => {
    const { spy } = hub({ log });
    await mcpFilesClient.changed(folder, "");
    expect(spy).toHaveBeenCalledWith("", "forms_git_commit_log", { branchID: "b1", path: "", limit: 1 });
  });

  it("gives nothing when the log is empty", async () => {
    hub({ log: [] });
    expect(await mcpFilesClient.changed(folder, "docs/plan.md")).toBeNull();
  });

  it("gives nothing, not an error, when the log cannot be read", async () => {
    hub({ failing: ["forms_git_commit_log"] });
    expect(await mcpFilesClient.changed(folder, "docs/plan.md")).toBeNull();
  });
});

describe("a whole walk through the files", () => {
  it("only ever calls the four read tools of the git module, never a write", async () => {
    const { seen } = hub({
      repos: [{ id: "r1", name: "Field notes", default_branch: "main", default_branch_id: "b1" }],
      dirs: {
        "": [dir("docs", "docs"), file("README.md", "README.md", 9), file("photo.png", "photo.png", 300), file("big.log", "big.log", fileSizeLimit + 1)],
        docs: [file("plan.md", "docs/plan.md", 11)],
      },
      blobs: {
        "README.md": { extension: "md", content: "Welcome!!" },
        "photo.png": { extension: "png", encoding: "base64", content: "AAEC" },
        "docs/plan.md": { extension: "md", content: "# The plan\n" },
      },
      log: [{ sha: "c1", author: "Amina", message: "Fix", timestamp: "2026-11-12T09:30:00Z" }],
    });
    const [only] = await mcpFilesClient.folders();
    await mcpFilesClient.list(only, "");
    await mcpFilesClient.list(only, "docs");
    await mcpFilesClient.read(only, "docs/plan.md");
    await mcpFilesClient.read(only, "photo.png");
    await mcpFilesClient.read(only, "big.log");
    await mcpFilesClient.readme(only, "");
    await mcpFilesClient.changed(only, "docs/plan.md");
    await mcpFilesClient.changed(only, "");
    const allowed = Object.values(filesTools);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.filter((tool) => !allowed.includes(tool))).toEqual([]);
    expect(new Set(seen)).toEqual(new Set(allowed));
  });
});

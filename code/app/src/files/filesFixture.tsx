import { act, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import { openAgency } from "../agency/open";
import * as mcp from "../shared/wakala/mcp";
import type { Changed, FileAnswer, FilesClient, Folder, FolderEntry, Listing, Readme } from "./api";
import { FilesRoutes } from "./index";

export const folder: Folder = { id: "r1", name: "Field notes", branchId: "b1", changedAt: "" };

export const budget: Folder = { id: "r2", name: "Budget", branchId: "b2", changedAt: "" };

export const twoHoursAgo = "2026-11-13T10:00:00Z";

export const threeDaysAgo = "2026-11-10T12:00:00Z";

export const agentOne: Changed = { when: twoHoursAgo, author: "Agent One" };

export const readmeText = "A first Folder for the notes.";

export const readme: Readme = { name: "README.md", path: "README.md", content: readmeText };

const entry = (name: string, path: string, size: number, isFolder = false): FolderEntry => ({ name, path, folder: isFolder, size });

export const rootEntries: FolderEntry[] = [
  entry("README.md", "README.md", 1200),
  entry("docs", "docs", 0, true),
  entry("main.go", "main.go", 120),
  entry("src", "src", 0, true),
  entry("go.mod", "go.mod", 30),
];

export const docsEntries: FolderEntry[] = [entry("a.md", "docs/a.md", 200), entry("b.md", "docs/b.md", 300), entry("notes", "docs/notes", 0, true)];

export const listings: Record<string, FolderEntry[]> = {
  "": rootEntries,
  docs: docsEntries,
  src: [],
  "docs/notes": [entry("c.md", "docs/notes/c.md", 10)],
};

export const contents: Record<string, string> = {
  "README.md": readmeText,
  "main.go": "package main",
  "go.mod": "module notes",
  "docs/a.md": "# Alpha",
  "docs/b.md": "# Beta",
  "docs/notes/c.md": "# Gamma",
};

export type Setup = {
  folders?: Folder[];
  listings?: Record<string, FolderEntry[]>;
  readme?: Readme | null;
  changes?: Record<string, Changed | null>;
  contents?: Record<string, string>;
  foldersFail?: boolean;
  listFail?: boolean;
  readFail?: boolean;
  answers?: Record<string, FileAnswer>;
};

export const at = (one: Folder, path: string) => `${one.id}:${path}`;

const extensionOf = (name: string) => (name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "");

export const makeClient = (setup: Setup = {}) => {
  const rows = setup.listings ?? listings;
  const files = setup.contents ?? contents;
  const client = {
    mounted: vi.fn(async () => true),
    folders: vi.fn(async () => {
      if (setup.foldersFail) throw new Error("down");
      return setup.folders ?? [folder];
    }),
    list: vi.fn(async (_folder: Folder, path: string): Promise<Listing> => {
      if (setup.listFail) throw new Error("down");
      return rows[path] ? { status: "listed", entries: rows[path] } : { status: "missing" };
    }),
    read: vi.fn(async (_folder: Folder, path: string): Promise<FileAnswer> => {
      if (setup.readFail) throw new Error("down");
      const given = setup.answers?.[path];
      if (given) return given;
      const content = files[path];
      if (content === undefined) return { status: "missing" };
      const name = path.slice(path.lastIndexOf("/") + 1);
      return { status: "text", name, path, extension: extensionOf(name), size: content.length, content };
    }),
    readme: vi.fn(async (_folder: Folder, path: string): Promise<Readme | null> => (path === "" ? (setup.readme === undefined ? readme : setup.readme) : null)),
    changed: vi.fn(async (one: Folder, path: string): Promise<Changed | null> => setup.changes?.[at(one, path)] ?? null),
  } satisfies FilesClient;
  return client;
};

export const widthQuery = "(min-width: 48rem)";

const stubMedia = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: wide && query === widthQuery,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as never;
};

export const prepare = (wide: boolean) => {
  openAgency("hub-1");
  vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [] } as never);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-13T12:00:00Z"));
  stubMedia(wide);
};

export const release = () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
};

const Where = () => {
  const here = useLocation();
  return <span data-testid="where">{here.pathname + here.search}</span>;
};

export const show = (start: string, setup: Setup = {}) => {
  const client = makeClient(setup);
  render(
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route path="/a/:agencyId/files/*" element={<FilesRoutes client={client} />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
  return client;
};

export const where = () => document.querySelector("[data-testid='where']")?.textContent;

export const rowTitles = () => Array.from(document.querySelectorAll(".row .ttl")).map((one) => one.textContent);

export const backText = () => document.querySelector(".back")?.textContent ?? "";

export const barTitle = () => document.querySelector(".bar-title")?.textContent;

export const nineFiles = (): Setup => {
  const names = Array.from({ length: 9 }, (_, index) => `f${index + 1}.md`);
  return {
    listings: { "": names.map((name) => entry(name, name, 10)) },
    contents: Object.fromEntries(names.map((name) => [name, `# ${name}`])),
    readme: null,
  };
};

export const goBack = () => act(() => (document.querySelector(".back") as HTMLElement).click());

export const treeNames = () => within(screen.getByRole("tree")).getAllByRole("treeitem").map((one) => one.getAttribute("aria-label"));

export const tabNames = () => screen.queryAllByRole("tab").map((one) => one.textContent);

export const activeTab = () => screen.queryAllByRole("tab").find((one) => one.getAttribute("aria-selected") === "true")?.textContent;

export const properties = () => {
  const panel = screen.queryByRole("complementary", { name: "Properties" });
  if (!panel) return null;
  return Object.fromEntries(Array.from(panel.querySelectorAll("dt")).map((term) => [term.textContent, term.nextElementSibling?.textContent]));
};

export const seen = (text: string) => screen.queryByText(text, { exact: false });

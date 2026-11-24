import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activeTab, agentOne, backText, barTitle, budget, folder, goBack, nineFiles, prepare, properties, readmeText, release, rowTitles, seen, show, tabNames, treeNames, where, type Setup } from "./filesFixture";

vi.mock("./viewer/FileViewer", () => ({
  FileViewer: (props: { name: string; extension: string; text: string | null; bytes?: Uint8Array | null }) => (
    <div data-testid="viewer" data-extension={props.extension} data-bytes={props.bytes ? props.bytes.length : ""}>
      {props.name}|{props.text ?? ""}
    </div>
  ),
}));

beforeEach(() => prepare(true));

afterEach(() => {
  cleanup();
  release();
});

const open = async (name: string) => {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("treeitem", { name }));
  return user;
};

const ready = async (start = "/a/hub-1/files/r1", setup: Setup = {}) => {
  const client = show(start, setup);
  await screen.findByRole("treeitem", { name: "Field notes" });
  return client;
};

describe("the tree on a wide window", () => {
  it("starts at the Folder's own name with its folders and then its files directly under it", async () => {
    await ready();
    await screen.findByRole("treeitem", { name: "main.go" });
    expect(treeNames()).toEqual(["Field notes", "docs", "src", "go.mod", "main.go", "README.md"]);
    const levels = within(screen.getByRole("tree")).getAllByRole("treeitem").map((one) => one.getAttribute("aria-level"));
    expect(levels).toEqual(["1", "2", "2", "2", "2", "2"]);
  });

  it("draws the Folders list at the Files index, for one Folder as for several, and no tree", async () => {
    show("/a/hub-1/files", { folders: [folder] });
    await screen.findByText("Field notes");
    expect(rowTitles()).toEqual(["Field notes"]);
    expect(screen.queryByRole("tree")).toBeNull();
    expect(barTitle()).toBe("Files");
  });

  it("opens a Folder's window when its row is tapped in the Folders list", async () => {
    const user = userEvent.setup();
    show("/a/hub-1/files", { folders: [folder, budget] });
    await user.click(await screen.findByText("Budget"));
    expect(where()).toBe("/a/hub-1/files/r2");
    await screen.findByRole("treeitem", { name: "Budget" });
  });

  it("goes from the Folders list back to Home", async () => {
    show("/a/hub-1/files", { folders: [folder, budget] });
    await screen.findByText("Budget");
    expect(backText()).toContain("Home");
    goBack();
    expect(where()).toBe("/a/hub-1/home");
  });

  it("goes from a Folder's window back to the Folders list, not to the same Folder", async () => {
    await ready();
    goBack();
    expect(where()).toBe("/a/hub-1/files");
    await screen.findByText("Field notes");
    expect(rowTitles()).toEqual(["Field notes"]);
    expect(screen.queryByRole("tree")).toBeNull();
  });

  it("is titled with the Folder's name, with Back reading Folders", async () => {
    await ready();
    expect(barTitle()).toBe("Field notes");
    expect(backText()).toContain("Folders");
  });

  it("selects the Folder's top row at first and shows its description with no tab open", async () => {
    await ready();
    expect(await screen.findByText(readmeText, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: "Field notes" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tablist", { name: "Open tabs" })).toBeInTheDocument();
    expect(tabNames()).toEqual([]);
  });

  it("lists a folder only when it is expanded, one list call for each expanded folder, kept after collapsing", async () => {
    const user = userEvent.setup();
    const client = await ready();
    await screen.findByRole("treeitem", { name: "main.go" });
    const asked = () => client.list.mock.calls.map((call) => call[1]);
    expect(asked()).not.toContain("docs");
    await user.click(screen.getByRole("button", { name: "Expand docs" }));
    await screen.findByRole("treeitem", { name: "a.md" });
    expect(treeNames()).toEqual(["Field notes", "docs", "notes", "a.md", "b.md", "src", "go.mod", "main.go", "README.md"]);
    expect(asked().filter((path) => path === "docs")).toHaveLength(1);
    expect(asked()).not.toContain("src");
    await user.click(screen.getByRole("button", { name: "Collapse docs" }));
    expect(treeNames()).toEqual(["Field notes", "docs", "src", "go.mod", "main.go", "README.md"]);
    await user.click(screen.getByRole("button", { name: "Expand docs" }));
    expect(asked().filter((path) => path === "docs")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Expand notes" }));
    await screen.findByRole("treeitem", { name: "c.md" });
    expect(asked().filter((path) => path === "docs/notes")).toHaveLength(1);
  });

  it("draws every tree icon in the accent colour", async () => {
    await ready();
    await screen.findByRole("treeitem", { name: "main.go" });
    const icons = document.querySelectorAll(".wf-tree .wf-icon");
    expect(icons).toHaveLength(5);
    icons.forEach((icon) => expect(icon).toHaveClass("fi"));
  });

  it("draws a guide under an expanded folder for its children and none at the top level", async () => {
    const user = userEvent.setup();
    await ready();
    await screen.findByRole("treeitem", { name: "main.go" });
    expect(document.querySelectorAll(".wf-guide")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Expand docs" }));
    await screen.findByRole("treeitem", { name: "a.md" });
    expect(screen.getByRole("treeitem", { name: "a.md" }).querySelector(".wf-guide")).not.toBeNull();
    expect(screen.getByRole("treeitem", { name: "docs" }).querySelector(".wf-guide")).toBeNull();
    expect(screen.getByRole("treeitem", { name: "README.md" }).querySelector(".wf-guide")).toBeNull();
  });

  it("opens a tab with the file's accent icon, the active one carrying the active class", async () => {
    await ready();
    await open("README.md");
    await open("main.go");
    const tabs = Array.from(document.querySelectorAll(".wf-tab"));
    expect(tabs).toHaveLength(2);
    tabs.forEach((tab) => expect(tab.querySelector(".fi")).not.toBeNull());
    expect(tabs[0]).not.toHaveClass("active");
    expect(tabs[1]).toHaveClass("active");
  });

  it("opens nothing when a chevron expands a folder, and marks the folder expanded", async () => {
    const user = userEvent.setup();
    await ready();
    await user.click(await screen.findByRole("button", { name: "Expand docs" }));
    await screen.findByRole("treeitem", { name: "a.md" });
    expect(tabNames()).toEqual([]);
    expect(screen.getByRole("treeitem", { name: "docs" })).toHaveAttribute("aria-expanded", "true");
  });

  it("makes no Changed call for a tree row, only for the selection", async () => {
    const client = await ready();
    await screen.findByRole("treeitem", { name: "main.go" });
    const asked = client.changed.mock.calls.map((call) => call[1]);
    expect(asked.every((path) => path === "")).toBe(true);
  });

  it("expands the folder and opens no tab when the window opens on a folder path", async () => {
    show("/a/hub-1/files/r1?path=docs");
    await screen.findByRole("treeitem", { name: "a.md" });
    expect(screen.getByRole("treeitem", { name: "docs" })).toHaveAttribute("aria-expanded", "true");
    expect(tabNames()).toEqual([]);
  });

  it("keeps a file's folders expanded and its row selected when the window opens on that file", async () => {
    show("/a/hub-1/files/r1/file?path=docs%2Fa.md");
    const row = await screen.findByRole("treeitem", { name: "a.md" });
    expect(row).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("treeitem", { name: "docs" })).toHaveAttribute("aria-expanded", "true");
    expect(activeTab()).toBe("a.md");
    expect(await screen.findByTestId("viewer")).toHaveTextContent("a.md|# Alpha");
  });
});

describe("an image on a wide window", () => {
  it("hands the image's extension and bytes to the viewer, with no text", async () => {
    const answers = { "photo.png": { status: "image", name: "photo.png", path: "photo.png", extension: "png", size: 3, bytes: new Uint8Array([0, 1, 2]) } } as const;
    show("/a/hub-1/files/r1/file?path=photo.png", { answers });
    const viewer = await screen.findByTestId("viewer");
    expect(viewer).toHaveTextContent("photo.png|");
    expect(viewer).toHaveAttribute("data-extension", "png");
    expect(viewer).toHaveAttribute("data-bytes", "3");
  });
});

describe("the tabs on a wide window", () => {
  it("opens a file in a new tab at the right end and shows its text", async () => {
    await ready();
    await open("README.md");
    await open("main.go");
    expect(tabNames()).toEqual(["README.md", "main.go"]);
    expect(activeTab()).toBe("main.go");
    expect(await screen.findByTestId("viewer")).toHaveTextContent("main.go|package main");
    expect(screen.getByRole("treeitem", { name: "main.go" })).toHaveAttribute("aria-selected", "true");
  });

  it("focuses the tab of a file that is already open, with no second tab", async () => {
    await ready();
    await open("README.md");
    await open("main.go");
    await open("go.mod");
    await open("main.go");
    expect(tabNames()).toEqual(["README.md", "main.go", "go.mod"]);
    expect(activeTab()).toBe("main.go");
  });

  it("focuses a tab when it is clicked and shows that file", async () => {
    await ready();
    await open("main.go");
    await open("go.mod");
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "main.go" }));
    expect(activeTab()).toBe("main.go");
    expect(await screen.findByTestId("viewer")).toHaveTextContent("main.go|package main");
  });

  it("expands a folder tapped by its name and collapses it on the next tap, opening no tab", async () => {
    await ready();
    await open("docs");
    await screen.findByRole("treeitem", { name: "a.md" });
    expect(tabNames()).toEqual([]);
    expect(screen.getByRole("treeitem", { name: "docs" })).toHaveAttribute("aria-expanded", "true");
    await open("docs");
    expect(screen.queryByRole("treeitem", { name: "a.md" })).toBeNull();
    expect(screen.getByRole("treeitem", { name: "docs" })).toHaveAttribute("aria-expanded", "false");
    expect(tabNames()).toEqual([]);
  });

  it("leaves the active file tab and its text alone when a folder is tapped", async () => {
    await ready();
    await open("main.go");
    await open("docs");
    await screen.findByRole("treeitem", { name: "a.md" });
    expect(tabNames()).toEqual(["main.go"]);
    expect(activeTab()).toBe("main.go");
    expect(screen.getByRole("treeitem", { name: "main.go" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByTestId("viewer")).toHaveTextContent("main.go|package main");
  });

  it("opens a file under an expanded folder in a tab", async () => {
    await ready();
    await open("docs");
    await open("a.md");
    expect(tabNames()).toEqual(["a.md"]);
    expect(activeTab()).toBe("a.md");
  });

  it("closes a tab with its x and makes its right neighbour active", async () => {
    await ready();
    await open("README.md");
    await open("main.go");
    await open("go.mod");
    await open("main.go");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close main.go" }));
    expect(tabNames()).toEqual(["README.md", "go.mod"]);
    expect(activeTab()).toBe("go.mod");
    expect(await screen.findByTestId("viewer")).toHaveTextContent("go.mod|module notes");
  });

  it("makes the left neighbour active when the last tab is closed", async () => {
    await ready();
    await open("README.md");
    await open("main.go");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close main.go" }));
    expect(tabNames()).toEqual(["README.md"]);
    expect(activeTab()).toBe("README.md");
  });

  it("shows the Folder's description over an empty strip when the last tab is closed", async () => {
    await ready();
    await open("main.go");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close main.go" }));
    expect(tabNames()).toEqual([]);
    expect(screen.getByRole("tablist", { name: "Open tabs" })).toBeInTheDocument();
    expect(screen.queryByText(/package main/)).toBeNull();
    expect(await screen.findByText(readmeText, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: "Field notes" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows only the description when the Folder's name is clicked, opening no tab and leaving the others", async () => {
    await ready();
    await open("main.go");
    expect(seen("package main")).not.toBeNull();
    await open("Field notes");
    expect(tabNames()).toEqual(["main.go"]);
    expect(activeTab()).toBeUndefined();
    expect(seen("package main")).toBeNull();
    expect(seen(readmeText)).not.toBeNull();
    expect(screen.getByRole("treeitem", { name: "Field notes" })).toHaveAttribute("aria-selected", "true");
  });

  it("says there is no description yet when the Folder has no README", async () => {
    await ready("/a/hub-1/files/r1", { readme: null });
    expect(await screen.findByText("No description yet")).toBeInTheDocument();
    expect(tabNames()).toEqual([]);
  });

  it("keeps every tab open however many files are opened", async () => {
    await ready("/a/hub-1/files/r1", nineFiles());
    for (let number = 1; number <= 9; number += 1) await open(`f${number}.md`);
    expect(tabNames()).toEqual(Array.from({ length: 9 }, (_, index) => `f${index + 1}.md`));
    expect(activeTab()).toBe("f9.md");
  });

  it("still focuses a tab opened long ago when its file is tapped again with nine tabs open", async () => {
    await ready("/a/hub-1/files/r1", nineFiles());
    for (let number = 1; number <= 9; number += 1) await open(`f${number}.md`);
    await open("f1.md");
    expect(activeTab()).toBe("f1.md");
    expect(tabNames()).toHaveLength(9);
  });
});

describe("the Properties on a wide window", () => {
  it("holds Name, Path, Items, Last changed and Changed by for the Folder at first", async () => {
    await ready("/a/hub-1/files/r1", { changes: { "r1:": agentOne } });
    await waitFor(() => expect(properties()?.["Changed by"]).toBe("Agent One"));
    expect(properties()).toEqual({ Name: "Field notes", Path: "/", Items: "5", "Last changed": "2 hours ago", "Changed by": "Agent One" });
  });

  it("holds Name, Path, Kind, Size, Last changed and Changed by for the active file", async () => {
    await ready("/a/hub-1/files/r1", { changes: { "r1:README.md": agentOne } });
    await open("README.md");
    await waitFor(() => expect(properties()?.["Changed by"]).toBe("Agent One"));
    expect(Object.keys(properties() ?? {})).toEqual(["Name", "Path", "Kind", "Size", "Last changed", "Changed by"]);
    expect(properties()).toMatchObject({ Name: "README.md", Path: "README.md", Kind: "Markdown document", Size: "1.2 KB", "Last changed": "2 hours ago" });
  });

  it("names the kind of a code file in plain words", async () => {
    await ready();
    await open("main.go");
    await waitFor(() => expect(properties()?.Name).toBe("main.go"));
    expect(properties()?.Kind).toBe("Go code");
  });

  it("keeps the Folder's Properties when a folder row is tapped", async () => {
    await ready();
    await open("docs");
    await screen.findByRole("treeitem", { name: "a.md" });
    expect(properties()).toMatchObject({ Name: "Field notes", Path: "/", Items: "5" });
  });

  it("shows a dash where a call has no answer", async () => {
    await ready();
    await open("main.go");
    await waitFor(() => expect(properties()?.Name).toBe("main.go"));
    expect(properties()?.["Last changed"]).toMatch(/^[-–—]$/);
    expect(properties()?.["Changed by"]).toMatch(/^[-–—]$/);
  });

  it("follows the active tab", async () => {
    await ready();
    await open("main.go");
    await open("go.mod");
    await waitFor(() => expect(properties()?.Name).toBe("go.mod"));
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "main.go" }));
    await waitFor(() => expect(properties()?.Name).toBe("main.go"));
  });
});

describe("the rest of the wide window", () => {
  it("has a status bar along the bottom holding only the branch dropdown, and no bottom bar", async () => {
    await ready();
    const bar = screen.getByLabelText("Status bar");
    await within(bar).findByRole("combobox", { name: "Branch" });
    expect(bar.children).toHaveLength(1);
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
  });

  it("shows the plain note, an empty strip, an empty tree and no Properties for an empty Folder", async () => {
    await ready("/a/hub-1/files/r1", { listings: { "": [] }, readme: null });
    expect(await screen.findByText("No description yet")).toBeInTheDocument();
    expect(tabNames()).toEqual([]);
    expect(treeNames()).toEqual(["Field notes"]);
    expect(screen.queryByRole("complementary", { name: "Properties" })).toBeNull();
    expect(screen.queryByText("Back to Folders")).toBeNull();
  });
});

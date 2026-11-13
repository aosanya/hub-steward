import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activeTab, agentOne, backText, barTitle, budget, folder, nineFiles, prepare, properties, readmeText, release, seen, show, tabNames, treeNames, type Setup } from "./filesFixture";

vi.mock("./viewer/FileViewer", () => ({
  FileViewer: (props: { name: string; text: string | null }) => <div data-testid="viewer">{props.name}|{props.text ?? ""}</div>,
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
    expect(treeNames()).toEqual(["Field notes", "docs", "src", "README.md", "main.go", "go.mod"]);
    const levels = within(screen.getByRole("tree")).getAllByRole("treeitem").map((one) => one.getAttribute("aria-level"));
    expect(levels).toEqual(["1", "2", "2", "2", "2", "2"]);
  });

  it("opens on the first Folder when it is reached at the Folders list, and draws no Folders list", async () => {
    show("/a/hub-1/files", { folders: [folder, budget] });
    await screen.findByRole("treeitem", { name: "Field notes" });
    expect(screen.queryByText("Budget")).toBeNull();
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
    expect(treeNames()).toEqual(["Field notes", "docs", "notes", "a.md", "b.md", "src", "README.md", "main.go", "go.mod"]);
    expect(asked().filter((path) => path === "docs")).toHaveLength(1);
    expect(asked()).not.toContain("src");
    await user.click(screen.getByRole("button", { name: "Collapse docs" }));
    expect(treeNames()).toEqual(["Field notes", "docs", "src", "README.md", "main.go", "go.mod"]);
    await user.click(screen.getByRole("button", { name: "Expand docs" }));
    expect(asked().filter((path) => path === "docs")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Expand notes" }));
    await screen.findByRole("treeitem", { name: "c.md" });
    expect(asked().filter((path) => path === "docs/notes")).toHaveLength(1);
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

  it("keeps a file's folders expanded and its row selected when the window opens on that file", async () => {
    show("/a/hub-1/files/r1/file?path=docs%2Fa.md");
    const row = await screen.findByRole("treeitem", { name: "a.md" });
    expect(row).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("treeitem", { name: "docs" })).toHaveAttribute("aria-expanded", "true");
    expect(activeTab()).toBe("a.md");
    expect(await screen.findByTestId("viewer")).toHaveTextContent("a.md|# Alpha");
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

  it("opens a folder tapped in the tree in a tab", async () => {
    await ready();
    await open("docs");
    expect(tabNames()).toEqual(["docs"]);
    expect(screen.getByRole("treeitem", { name: "docs" })).toHaveAttribute("aria-selected", "true");
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

  it("keeps at most 8 tabs, closing the one unused longest and never the one just opened", async () => {
    await ready("/a/hub-1/files/r1", nineFiles());
    for (let number = 1; number <= 8; number += 1) await open(`f${number}.md`);
    expect(tabNames()).toHaveLength(8);
    await open("f1.md");
    await open("f9.md");
    expect(tabNames()).toHaveLength(8);
    expect(tabNames()).not.toContain("f2.md");
    expect(tabNames()).toContain("f1.md");
    expect(activeTab()).toBe("f9.md");
  });

  it("can open the tab closed for room again", async () => {
    await ready("/a/hub-1/files/r1", nineFiles());
    for (let number = 1; number <= 9; number += 1) await open(`f${number}.md`);
    expect(tabNames()).not.toContain("f1.md");
    await open("f1.md");
    expect(activeTab()).toBe("f1.md");
    expect(tabNames()).toHaveLength(8);
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

  it("holds the item count of a folder and no Kind or Size", async () => {
    await ready("/a/hub-1/files/r1", { changes: { "r1:docs": agentOne } });
    await open("docs");
    await waitFor(() => expect(properties()?.Name).toBe("docs"));
    expect(Object.keys(properties() ?? {})).toEqual(["Name", "Path", "Items", "Last changed", "Changed by"]);
    expect(properties()).toMatchObject({ Path: "docs", Items: "3" });
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
  it("has an empty status bar along the bottom and no bottom bar", async () => {
    await ready();
    expect(screen.getByLabelText("Status bar")).toBeEmptyDOMElement();
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

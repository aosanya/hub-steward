import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { backText, barTitle, folder, goBack, prepare, readmeText, release, rowTitles, show, where } from "./filesFixture";

beforeEach(() => prepare(false));

afterEach(() => {
  cleanup();
  release();
});

describe("a Folder's top level on a phone", () => {
  it("is titled with the Folder's name, and Back reads Folders and leads to the Folders list", async () => {
    show("/a/hub-1/files/r1");
    await screen.findByText("docs");
    expect(barTitle()).toBe("Field notes");
    expect(backText()).toContain("Folders");
    goBack();
    expect(where()).toBe("/a/hub-1/files");
  });

  it("lists the folders first and then the files, each group sorted by name", async () => {
    show("/a/hub-1/files/r1");
    await screen.findByText("docs");
    expect(rowTitles()).toEqual(["docs", "src", "go.mod", "main.go", "README.md"]);
  });

  it("shows a file's size at the right end of its row and nothing under a folder's row, and no Changed line", async () => {
    show("/a/hub-1/files/r1");
    await screen.findByText("docs");
    const rows = Array.from(document.querySelectorAll(".row"));
    expect(rows[0].querySelector(".meta")).toBeNull();
    expect(rows[4].querySelector(".meta")).toBeNull();
    expect(rows[4].lastElementChild?.textContent).toBe("1.2 KB");
    expect(rows[4].lastElementChild).toHaveClass("end");
    expect(screen.queryByText(/^Changed/)).toBeNull();
  });

  it("draws every row's icon in the accent colour", async () => {
    show("/a/hub-1/files/r1");
    await screen.findByText("docs");
    const marks = Array.from(document.querySelectorAll(".row > .mark"));
    expect(marks).toHaveLength(5);
    marks.forEach((mark) => expect(mark).toHaveClass("fi"));
  });

  it("draws the README text under the list", async () => {
    show("/a/hub-1/files/r1");
    await screen.findByText("docs");
    const block = await screen.findByText(readmeText);
    const rows = document.querySelectorAll(".row");
    expect(block.closest(".readme")).not.toBeNull();
    expect(rows[rows.length - 1].compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("draws no README block when the Folder has none", async () => {
    const client = show("/a/hub-1/files/r1", { readme: null });
    await screen.findByText("docs");
    expect(client.readme).toHaveBeenCalledWith(folder, "");
    expect(document.querySelector(".readme")).toBeNull();
    expect(screen.queryByText(readmeText)).toBeNull();
  });

  it("goes one folder down when a folder row is tapped", async () => {
    const user = userEvent.setup();
    show("/a/hub-1/files/r1");
    await user.click(await screen.findByText("docs"));
    expect(where()).toBe("/a/hub-1/files/r1?path=docs");
  });

  it("opens a file's screen when a file row is tapped", async () => {
    const user = userEvent.setup();
    show("/a/hub-1/files/r1");
    await user.click(await screen.findByText("main.go"));
    expect(where()).toBe("/a/hub-1/files/r1/file?path=main.go");
  });

  it("shows no tree, no tab strip and no Properties, and keeps the bottom bar", async () => {
    show("/a/hub-1/files/r1");
    await screen.findByText("docs");
    expect(screen.queryByRole("tree")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Properties" })).toBeNull();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("says in plain words that the Folder could not be loaded, with Try again", async () => {
    const user = userEvent.setup();
    const client = show("/a/hub-1/files/r1", { listFail: true });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/repositor|branch|commit|diff|merge/i);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(client.list.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("says a Folder that is not in the list was not found", async () => {
    show("/a/hub-1/files/zzz");
    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });
});

describe("a folder inside a folder on a phone", () => {
  it("is titled with the folder's name, lists it one level down and has no README block", async () => {
    show("/a/hub-1/files/r1?path=docs");
    await screen.findByText("a.md");
    expect(barTitle()).toBe("docs");
    expect(rowTitles()).toEqual(["notes", "a.md", "b.md"]);
    expect(document.querySelector(".readme")).toBeNull();
  });

  it("has Back name the Folder above it and lead to the Folder's top level", async () => {
    show("/a/hub-1/files/r1?path=docs");
    await screen.findByText("a.md");
    expect(backText()).toContain("Field notes");
    goBack();
    expect(where()).toBe("/a/hub-1/files/r1");
  });

  it("goes another level down, with the whole path in the path parameter", async () => {
    const user = userEvent.setup();
    show("/a/hub-1/files/r1?path=docs");
    await user.click(await screen.findByText("notes"));
    expect(where()).toBe("/a/hub-1/files/r1?path=docs%2Fnotes");
  });

  it("has Back at the second level name the folder above and lead to it", async () => {
    show("/a/hub-1/files/r1?path=docs%2Fnotes");
    await screen.findByText("c.md");
    expect(barTitle()).toBe("notes");
    expect(backText()).toContain("docs");
    goBack();
    expect(where()).toBe("/a/hub-1/files/r1?path=docs");
  });

  it("opens a file inside the folder with its whole path", async () => {
    const user = userEvent.setup();
    show("/a/hub-1/files/r1?path=docs");
    await user.click(await screen.findByText("a.md"));
    expect(where()).toBe("/a/hub-1/files/r1/file?path=docs%2Fa.md");
  });

  it("says a folder that is not there was not found", async () => {
    show("/a/hub-1/files/r1?path=nope");
    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
    expect(rowTitles()).toEqual([]);
  });
});

describe("an empty Folder on a phone", () => {
  it("shows a card with its act inside it, under the Folder's name with Back reading Folders", async () => {
    const user = userEvent.setup();
    show("/a/hub-1/files/r1", { listings: { "": [] }, readme: null });
    expect(await screen.findByText("Nothing in this Folder yet")).toBeInTheDocument();
    expect(screen.getByText("Files that people or agents add to it show here.")).toBeInTheDocument();
    expect(barTitle()).toBe("Field notes");
    expect(backText()).toContain("Folders");
    const act = screen.getByText("Back to Folders");
    expect(act.closest(".card")).not.toBeNull();
    await user.click(act);
    expect(where()).toBe("/a/hub-1/files");
  });
});

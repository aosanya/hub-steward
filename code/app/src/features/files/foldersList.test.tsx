import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { agentOne, backText, barTitle, budget, folder, goBack, prepare, release, rowTitles, show, threeDaysAgo, where } from "./filesFixture";

const agentTwo = { when: threeDaysAgo, author: "Agent Two" };

beforeEach(() => prepare(false));

afterEach(() => {
  cleanup();
  release();
});

describe("the Folders list on a phone", () => {
  it("draws one row for each Folder, by its name", async () => {
    show("/a/hub-1/files", { folders: [folder, budget] });
    await screen.findByText("Budget");
    expect(rowTitles()).toEqual(["Field notes", "Budget"]);
  });

  it("draws the list for a single Folder too", async () => {
    show("/a/hub-1/files");
    await screen.findByText("Field notes");
    expect(rowTitles()).toEqual(["Field notes"]);
  });

  it("is titled Files, with Back reading Home and leading to Home, and keeps the bottom bar", async () => {
    show("/a/hub-1/files");
    await screen.findByText("Field notes");
    expect(barTitle()).toBe("Files");
    expect(backText()).toContain("Home");
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    goBack();
    expect(where()).toBe("/a/hub-1/home");
  });

  it("says under each row when its Folder last changed, from the list itself with no call for each Folder", async () => {
    const client = show("/a/hub-1/files", {
      folders: [
        { ...folder, changedAt: agentOne.when },
        { ...budget, changedAt: agentTwo.when },
      ],
    });
    expect(await screen.findByText("Changed 2 hours ago")).toBeInTheDocument();
    expect(screen.getByText("Changed 3 days ago")).toBeInTheDocument();
    expect(client.changed).not.toHaveBeenCalled();
  });

  it("leaves the Changed line off a row whose Folder has no time", async () => {
    show("/a/hub-1/files", { folders: [{ ...folder, changedAt: agentOne.when }, budget] });
    await screen.findByText("Changed 2 hours ago");
    expect(screen.queryAllByText(/^Changed/)).toHaveLength(1);
  });

  it("opens a Folder's top level when its row is tapped", async () => {
    const user = userEvent.setup();
    show("/a/hub-1/files", { folders: [folder, budget] });
    await user.click(await screen.findByText("Budget"));
    expect(where()).toBe("/a/hub-1/files/r2");
  });

  it("shows no tree, no tab strip and no Properties", async () => {
    show("/a/hub-1/files");
    await screen.findByText("Field notes");
    expect(screen.queryByRole("tree")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Properties" })).toBeNull();
  });

  it("says in plain words that the Folders could not be loaded, with Try again, and never names a repository, branch or commit", async () => {
    const user = userEvent.setup();
    const client = show("/a/hub-1/files", { foldersFail: true });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Folders/);
    expect(document.body.textContent).not.toMatch(/repositor|branch|commit|diff|merge/i);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(client.folders).toHaveBeenCalledTimes(2);
  });
});

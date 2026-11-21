import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepare, release, show, tabNames, treeNames, type Setup } from "./filesFixture";

vi.mock("./viewer/FileViewer", () => ({
  FileViewer: (props: { name: string; text: string | null }) => (
    <div data-testid="viewer">
      {props.name}|{props.text ?? ""}
    </div>
  ),
}));

beforeEach(() => prepare(true));

afterEach(() => {
  cleanup();
  release();
});

const branches: Setup["branches"] = [
  { id: "b2", name: "feature-a", isDefault: false },
  { id: "b1", name: "main", isDefault: true },
  { id: "b3", name: "archive", isDefault: false },
];

const ready = async (setup: Setup = {}) => {
  const client = show("/a/hub-1/files/r1", { branches, ...setup });
  await screen.findByRole("treeitem", { name: "Field notes" });
  return client;
};

const picker = async () => (await screen.findByRole("combobox", { name: "Branch" })) as HTMLSelectElement;

describe("the branch dropdown on a wide window", () => {
  it("lists the default branch first and then the others by name, with the default chosen", async () => {
    await ready();
    const select = await picker();
    expect(within(select).getAllByRole("option").map((one) => one.textContent)).toEqual(["main", "archive", "feature-a"]);
    expect(select.value).toBe("b1");
  });

  it("sits in the status bar, outside the tree of files", async () => {
    await ready();
    const select = await picker();
    expect(screen.getByRole("contentinfo", { name: "Status bar" }).contains(select)).toBe(true);
    expect(screen.getByRole("tree").contains(select)).toBe(false);
    expect(treeNames()[0]).toBe("Field notes");
  });

  it("opens the tree of the branch that is chosen, on that branch's id", async () => {
    const client = await ready();
    const user = userEvent.setup();
    await screen.findByRole("treeitem", { name: "main.go" });
    await user.selectOptions(await picker(), "b2");
    await waitFor(() => expect(client.list).toHaveBeenCalledWith(expect.objectContaining({ id: "r1", branchId: "b2" }), ""));
    expect((await picker()).value).toBe("b2");
  });

  it("closes the open files when the branch changes", async () => {
    await ready();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("treeitem", { name: "main.go" }));
    expect(tabNames()).toEqual(["main.go"]);
    await user.selectOptions(await picker(), "b2");
    await waitFor(() => expect(tabNames()).toEqual([]));
  });

  it("is left out when the branches cannot be read, and the files still show", async () => {
    await ready({ branchesFail: true });
    await screen.findByRole("treeitem", { name: "main.go" });
    expect(screen.queryByRole("combobox", { name: "Branch" })).toBeNull();
  });
});

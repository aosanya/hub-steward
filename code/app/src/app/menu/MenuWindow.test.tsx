import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import { MenuWindow } from "./MenuWindow";

const listTool = "agency_list_records";
const readTool = "agency_get_record";

const list = {
  title: "Folders",
  tool: listTool,
  fields: { title: "name", meta: "kind" },
  empty: { words: "No folders yet", act: "Back to Home", to: "/a/town/home" },
};

const detail = { tool: readTool, fields: { Owner: "owner" }, status: "state" };

const css = readFileSync(resolve(__dirname, "menuWindow.css"), "utf8");

beforeEach(() => {
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) =>
    name === listTool
      ? { items: [{ id: "f1", name: "Okafor", kind: "Household" }, { id: "f2", name: "Bello", kind: "Household" }] }
      : { item: { id: (args as { id: string }).id, owner: "Ada", state: "Open" } },
  );
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const open = () =>
  render(
    <MemoryRouter initialEntries={["/a/town/menu/folders"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/folders" element={<MenuWindow title="Folder" list={list} detail={detail} />} />
      </Routes>
    </MemoryRouter>,
  );

const window_ = () => document.querySelector(".mw") as HTMLElement;

describe("the Folders window", () => {
  it("shows only the list until a row is chosen", async () => {
    open();
    await screen.findByText("Okafor");

    expect(window_()).toHaveAttribute("data-chosen", "no");
    expect(document.querySelector(".mw-detail")).toBeNull();
  });

  it("opens the chosen row beside the list, with that row marked chosen", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Okafor/ }));

    const detailPane = await waitForPane(".mw-detail");
    expect(await within(detailPane).findByText("Ada")).toBeInTheDocument();
    expect(within(document.querySelector(".mw-list") as HTMLElement).getByText("Bello")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Okafor/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Bello/ })).toHaveAttribute("aria-pressed", "false");
    expect(window_()).toHaveAttribute("data-chosen", "yes");
  });

  it("swaps the right pane when another row is chosen", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Okafor/ }));
    await userEvent.click(screen.getByRole("button", { name: /Bello/ }));

    expect(vi.mocked(mcp.callTool)).toHaveBeenCalledWith("", readTool, { id: "f2" });
  });

  it("draws one screen frame, not one per pane", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Okafor/ }));
    await waitForPane(".mw-detail");

    expect(document.querySelectorAll("main")).toHaveLength(1);
  });

  it("goes back from the chosen row to the list on a phone", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Okafor/ }));
    await userEvent.click(screen.getByRole("button", { name: /Folders/ }));

    expect(window_()).toHaveAttribute("data-chosen", "no");
  });
});

describe("the Folders window layout", () => {
  it("hides the list on a phone once a row is chosen, so one pane shows", () => {
    const phone = css.slice(0, css.indexOf("@media"));
    expect(phone).toMatch(/\.mw\[data-chosen="yes"\] \.mw-list\s*\{[^}]*display: none/);
  });

  it("puts list and chosen row side by side only inside one min-width block", () => {
    const wide = css.slice(css.indexOf("@media (min-width: 48rem)"));
    expect(wide).toMatch(/\.mw\s*\{[^}]*display: grid[^}]*grid-template-columns/);
    expect(wide).toMatch(/\.mw\[data-chosen="yes"\] \.mw-list\s*\{[^}]*display: flex/);
    expect(css.slice(0, css.indexOf("@media"))).not.toContain("display: grid");
  });
});

const waitForPane = async (selector: string) => {
  await screen.findByRole("region", { name: "Folder" });
  return document.querySelector(selector) as HTMLElement;
};

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
  empty: { words: "No folders yet" },
};

const detail = { tool: readTool, fields: { Owner: "owner" }, status: "state" };

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

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
  Reflect.deleteProperty(window, "matchMedia");
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

const frame = () => document.querySelector(".wf") as HTMLElement | null;

describe("the menu window on a wide screen", () => {
  it("draws the Folders frame with the list as its left pane", async () => {
    setWide(true);
    open();
    await screen.findByText("Okafor");

    expect(frame()).not.toBeNull();
    const panes = frame()?.querySelector(".wf-panes") as HTMLElement;
    expect(within(panes.querySelector(".wf-tree") as HTMLElement).getByText("Bello")).toBeInTheDocument();
  });

  it("opens the chosen row in the main pane under a head strip carrying the window title", async () => {
    setWide(true);
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Okafor/ }));

    const main = frame()?.querySelector(".wf-main") as HTMLElement;
    expect(within(main.querySelector(".wf-head") as HTMLElement).getByText("Folder")).toBeInTheDocument();
    expect(await within(main.querySelector(".wf-content") as HTMLElement).findByText("Ada")).toBeInTheDocument();
  });

  it("keeps the list beside the opened row and marks the chosen row", async () => {
    setWide(true);
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Okafor/ }));

    const panes = frame()?.querySelector(".wf-panes") as HTMLElement;
    expect(within(panes.querySelector(".wf-tree") as HTMLElement).getByRole("button", { name: /Okafor/ })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("the menu window on a phone", () => {
  it("draws no Folders frame, so one padded pane shows at a time", async () => {
    setWide(false);
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Okafor/ }));

    expect(frame()).toBeNull();
    expect(document.querySelector(".mw")).toHaveAttribute("data-chosen", "yes");
  });
});

describe("the shared pane rules", () => {
  const sharedCss = () => readFileSync(resolve(__dirname, "../../shared/ui/paneWindow.css"), "utf8");
  const filesCss = () => readFileSync(resolve(__dirname, "../../features/files/wideFiles.css"), "utf8");

  it("define the frame and panes once, in the shared file", () => {
    expect(sharedCss()).toMatch(/\.wf-panes\s*\{/);
    expect(sharedCss()).toMatch(/\.wf-tree\s*\{/);
    expect(sharedCss()).toMatch(/\.wf-main\s*\{/);
    expect(filesCss()).not.toMatch(/^\.wf-panes\s*\{/m);
    expect(filesCss()).not.toMatch(/^\.wf-tree\s*\{/m);
  });

  it("set no font size in pixels", () => {
    expect(sharedCss()).not.toMatch(/font-size:\s*[\d.]+px/);
  });

  it("keeps the frame at the viewport height so a long list scrolls in its pane, not the page", () => {
    const ruleBody = (selector: string) => new RegExp(`^\\.${selector}\\s*\\{([^}]*)\\}`, "m").exec(sharedCss())?.[1] ?? "";

    expect(ruleBody("wf")).toMatch(/height:\s*calc\(100dvh - 3rem\)/);
    expect(ruleBody("wf")).toMatch(/flex:\s*none/);
    expect(ruleBody("wf")).not.toMatch(/flex:\s*1\b/);
    expect(ruleBody("wf-tree")).toMatch(/overflow:\s*auto/);
    expect(ruleBody("wf-content")).toMatch(/overflow:\s*auto/);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

type Row = { id: string; name: string; kind: string };

const folders = (...rows: Row[]) => rows;

const okafor = { id: "f1", name: "Okafor", kind: "Household" };
const bello = { id: "f2", name: "Bello", kind: "Household" };
const cole = { id: "f3", name: "Cole", kind: "Tenant" };

const serve = (rows: Row[]) => {
  vi.mocked(mcp.callTool).mockImplementation(async (_agency, name, args) =>
    name === listTool ? { items: rows } : { item: { id: (args as { id: string }).id, owner: `Owner of ${(args as { id: string }).id}`, state: "Open" } },
  );
};

const openWith = (props: { list?: Partial<typeof list> & Record<string, unknown>; listKey?: number; elsewhere?: (id: string) => boolean; leave?: (id: string) => void }) =>
  (
    <MemoryRouter initialEntries={["/a/town/menu/folders"]}>
      <Routes>
        <Route
          path="/a/:agencyId/menu/folders"
          element={<MenuWindow title="Folder" list={{ ...list, ...props.list }} detail={detail} listKey={props.listKey} elsewhere={props.elsewhere} leave={props.leave} />}
        />
      </Routes>
    </MemoryRouter>
  );

const content = () => frame()?.querySelector(".wf-main .wf-content") as HTMLElement | null;

const readCalls = () => vi.mocked(mcp.callTool).mock.calls.filter(([, name]) => name === readTool).map(([, , args]) => (args as { id: string }).id);

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

describe("the first row opening by itself on a wide screen", () => {
  it("chooses the first row and draws its detail pane with no tap", async () => {
    setWide(true);
    open();
    await screen.findByText("Okafor");

    expect(await screen.findByText("Ada")).toBeInTheDocument();
    expect(content()).not.toBeNull();
    expect(screen.getByRole("button", { name: /Okafor/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Bello/ })).toHaveAttribute("aria-pressed", "false");
    expect(readCalls()).toEqual(["f1"]);
  });

  it("puts the window title in the head strip of the pane it opened", async () => {
    setWide(true);
    open();
    await screen.findByText("Okafor");

    await screen.findByRole("region", { name: "Folder" });
    const main = frame()?.querySelector(".wf-main.mw-detail") as HTMLElement;
    expect(within(main.querySelector(".wf-head") as HTMLElement).getByText("Folder")).toBeInTheDocument();
  });

  it("chooses the first row in displayed order when the list is grouped", async () => {
    setWide(true);
    serve(folders(okafor, bello, cole));
    const grouped = (items: Record<string, unknown>[]) => [
      { heading: "Tenants", items: items.filter((item) => item.kind === "Tenant") },
      { heading: "Households", items: items.filter((item) => item.kind === "Household") },
    ];
    render(openWith({ list: { groups: grouped } }));
    await screen.findByText("Cole");

    await waitFor(() => expect(screen.getByRole("button", { name: /Cole/ })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("button", { name: /Okafor/ })).toHaveAttribute("aria-pressed", "false");
    expect(readCalls()).toEqual(["f3"]);
  });

  it("does not replace the row the person chose", async () => {
    setWide(true);
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Okafor/ }));
    await userEvent.click(screen.getByRole("button", { name: /Bello/ }));

    expect(await within(content() as HTMLElement).findByText("Ada")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /Bello/ })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("button", { name: /Okafor/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the chosen row when the list reloads and the row is still there", async () => {
    setWide(true);
    serve(folders(okafor, bello));
    const view = render(openWith({ listKey: 1 }));
    await userEvent.click(await screen.findByRole("button", { name: /Bello/ }));
    serve(folders(cole, okafor, bello));
    view.rerender(openWith({ listKey: 2 }));
    await screen.findByText("Cole");

    await waitFor(() => expect(screen.getByRole("button", { name: /Bello/ })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("button", { name: /Cole/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Okafor/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("chooses the first row when the list reloads without the chosen row", async () => {
    setWide(true);
    serve(folders(okafor, bello));
    const view = render(openWith({ listKey: 1 }));
    await userEvent.click(await screen.findByRole("button", { name: /Bello/ }));
    serve(folders(cole, okafor));
    view.rerender(openWith({ listKey: 2 }));
    await screen.findByText("Cole");

    await waitFor(() => expect(screen.getByRole("button", { name: /Cole/ })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.queryByRole("button", { name: /Bello/ })).toBeNull();
    expect(await within(content() as HTMLElement).findByText("Owner of f3")).toBeInTheDocument();
  });

  it("skips a row that opens elsewhere and chooses the first row that can be chosen", async () => {
    setWide(true);
    render(openWith({ elsewhere: (id) => id === "f1" }));
    await screen.findByText("Okafor");

    await waitFor(() => expect(screen.getByRole("button", { name: /Bello/ })).toHaveAttribute("aria-pressed", "true"));
    expect(await screen.findByText("Ada")).toBeInTheDocument();
    expect(readCalls()).toEqual(["f2"]);
  });

  it("leaves only when a row that opens elsewhere is tapped, never when the first row is chosen by itself", async () => {
    setWide(true);
    const leave = vi.fn();
    render(openWith({ elsewhere: (id) => id === "f1", leave }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Bello/ })).toHaveAttribute("aria-pressed", "true"));

    expect(leave).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Okafor/ }));
    expect(leave).toHaveBeenCalledWith("f1");
    expect(screen.getByRole("button", { name: /Bello/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("skips a row the list says does not open and chooses the first row that does", async () => {
    setWide(true);
    render(openWith({ list: { opens: (item: Record<string, unknown>) => item.id !== "f1" } }));
    await screen.findByText("Okafor");

    await waitFor(() => expect(screen.getByRole("button", { name: /Bello/ })).toHaveAttribute("aria-pressed", "true"));
    expect(readCalls()).toEqual(["f2"]);
  });

  it("shows the empty state and no detail pane when the list has no rows", async () => {
    setWide(true);
    serve(folders());
    render(openWith({}));

    expect(await screen.findByText("No folders yet")).toBeInTheDocument();
    expect(frame()?.querySelector(".mw-detail")).toBeNull();
    expect(content()).toBeNull();
    expect(readCalls()).toEqual([]);
  });
});

describe("the menu window on a phone", () => {
  it("chooses no row by itself, so the list stays the page", async () => {
    setWide(false);
    open();
    await screen.findByText("Okafor");

    expect(document.querySelector(".mw")).toHaveAttribute("data-chosen", "no");
    expect(document.querySelector(".mw-detail")).toBeNull();
    expect(readCalls()).toEqual([]);
  });

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

    expect(ruleBody("wf-tree")).toMatch(/overflow:\s*auto/);
    expect(ruleBody("wf-content")).toMatch(/overflow:\s*auto/);
  });

  it("sizes the frame by what the bar leaves, not by a fixed offset", () => {
    const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\>]/g, "\\$&");
    const bodyOf = (selector: string) => new RegExp(`^${escape(selector)}\\s*\\{([^}]*)\\}`, "m").exec(sharedCss())?.[1] ?? "";

    expect(bodyOf(".wf")).toMatch(/flex:\s*1\b/);
    expect(bodyOf(".wf")).toMatch(/min-height:\s*0/);
    expect(bodyOf(".wf")).not.toMatch(/height:\s*calc/);
    expect(bodyOf(".page:has(> .body > .wf)")).toMatch(/height:\s*100dvh/);
    expect(bodyOf(".frame .body:has(> .wf)")).toMatch(/min-height:\s*0/);
    expect(sharedCss()).not.toMatch(/\.wf-tabbed[^{]*\{/);
  });
});

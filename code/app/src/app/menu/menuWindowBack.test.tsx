import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import { MenuWindow } from "./MenuWindow";

const listTool = "agency_list_records";
const readTool = "agency_get_record";

const list = { title: "All Residents", tool: listTool, fields: { title: "name", meta: "kind" }, empty: { words: "No residents yet" } };
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

const origin = { from: { path: "/a/town/menu/groups", title: "Groups" } };

const openLinked = (state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/people", state }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/people" element={<MenuWindow title="Resident" list={list} detail={detail} startAt="f1" />} />
        <Route path="/a/:agencyId/menu/groups" element={<p>The groups page</p>} />
      </Routes>
    </MemoryRouter>,
  );

const window_ = () => document.querySelector(".mw") as HTMLElement;

describe("a resident opened from a link on a phone", () => {
  it("has a back arrow named after the list when the link came with no origin, and it shows the list", async () => {
    openLinked();
    await screen.findByRole("region", { name: "Resident" });

    await userEvent.click(screen.getByRole("button", { name: /All Residents/ }));

    expect(window_()).toHaveAttribute("data-chosen", "no");
    expect(await screen.findByText("Bello")).toBeInTheDocument();
  });

  it("keeps the back arrow going to where the person came from when there is an origin", async () => {
    openLinked(origin);
    await screen.findByRole("region", { name: "Resident" });

    await userEvent.click(screen.getByRole("button", { name: /Groups/ }));

    expect(await screen.findByText("The groups page")).toBeInTheDocument();
  });

  it("adds an All Residents row above the page when there is an origin, and it shows the list", async () => {
    openLinked(origin);
    const pane = await screen.findByRole("region", { name: "Resident" });
    const row = pane.querySelector(".mw-all") as HTMLElement;

    expect(row).not.toBeNull();
    expect(row).toHaveTextContent("All Residents");

    await userEvent.click(row);

    expect(window_()).toHaveAttribute("data-chosen", "no");
  });

  it("draws no All Residents row when the back arrow already goes to the list", async () => {
    openLinked();
    await screen.findByRole("region", { name: "Resident" });

    expect(document.querySelector(".mw-all")).toBeNull();
  });
});

describe("the same link on a wide screen", () => {
  it("keeps the list beside the page and draws no All Residents row", async () => {
    setWide(true);
    openLinked(origin);
    await screen.findByRole("region", { name: "Resident" });

    expect(document.querySelector(".mw-all")).toBeNull();
    expect(await screen.findByText("Bello")).toBeInTheDocument();
  });
});

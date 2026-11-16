import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import { MenuList } from "./MenuList";

const tool = "agency_list_issues";

const fields = { title: "name", meta: "status" };

const empty = { words: "No issues yet", act: "Back to Home", to: "/a/town/home" };

const issues = [
  { id: "i1", name: "Bridge repair", status: "Open" },
  { id: "i2", name: "Street light out", status: "Assigned" },
  { id: "i3", name: "Bridge railing", status: "Overdue" },
];

const origin = { path: "/a/town/menu/issues", title: "Issues & Requests" };

let landed = "";
let called: MockInstance<typeof mcp.callTool>;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

beforeEach(() => {
  openAgency("town");
  called = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: issues });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const toolCalls = () => called.mock.calls.filter(([, name]) => name === tool);

const list = (entry: string | { pathname: string; state: unknown } = { pathname: "/a/town/menu/issues/all", state: { from: origin } }) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/a/:agencyId/menu/issues/all" element={<MenuList title="All Issues" tool={tool} fields={fields} empty={empty} />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

describe("the shared menu list", () => {
  it("draws a row for each item the tool returned, with its meta line", async () => {
    list();

    expect(await screen.findByText("Bridge repair")).toBeInTheDocument();
    expect(screen.getByText("Street light out")).toBeInTheDocument();
    expect(screen.getByText("Bridge railing")).toBeInTheDocument();
    expect(screen.getByText("Assigned")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All Issues" })).toBeInTheDocument();
    expect(toolCalls()).toHaveLength(1);
  });

  it("filters the rows already loaded as the person types, without calling the tool again", async () => {
    list();
    await screen.findByText("Bridge repair");

    await userEvent.type(screen.getByRole("searchbox"), "bridge");

    expect(screen.getByText("Bridge repair")).toBeInTheDocument();
    expect(screen.getByText("Bridge railing")).toBeInTheDocument();
    expect(screen.queryByText("Street light out")).toBeNull();
    expect(toolCalls()).toHaveLength(1);
  });

  it("brings every row back when the search is cleared", async () => {
    list();
    await screen.findByText("Bridge repair");
    await userEvent.type(screen.getByRole("searchbox"), "street");
    expect(screen.queryByText("Bridge repair")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(screen.getByText("Bridge repair")).toBeInTheDocument();
    expect(screen.getByText("Street light out")).toBeInTheDocument();
    expect(toolCalls()).toHaveLength(1);
  });

  it("shows the empty state as a card with its act inside it when the tool returned nothing", async () => {
    called.mockResolvedValue({ items: [] });
    list();

    const words = await screen.findByText(empty.words);
    const card = words.closest(".card") as HTMLElement;
    expect(card).not.toBeNull();
    const act = within(card).getByRole("button", { name: empty.act });
    expect(card.querySelector("svg, img")).toBeNull();

    await userEvent.click(act);

    expect(landed).toBe("/a/town/home");
  });

  it("keeps the search bar on top and does not show the empty card while rows are present", async () => {
    list();
    await screen.findByText("Bridge repair");

    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    expect(screen.queryByText(empty.words)).toBeNull();
  });

  it("has a Back button that reads the name of the screen the person came from and goes there", async () => {
    list();
    await screen.findByText("Bridge repair");

    const back = screen.getByRole("button", { name: /Issues & Requests/ });
    await userEvent.click(back);

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("reads another origin's name when the person came from somewhere else", async () => {
    list({ pathname: "/a/town/menu/issues/all", state: { from: { path: "/a/town/menu/services", title: "Services & Permits" } } });
    await screen.findByText("Bridge repair");

    expect(screen.getByRole("button", { name: /Services & Permits/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Issues & Requests/ })).toBeNull();
  });

  it("draws the rows in the order the tool gave them", async () => {
    list();
    await screen.findByText("Bridge repair");

    expect(screen.getAllByText(/Bridge|Street/).map((node) => node.textContent)).toEqual(["Bridge repair", "Street light out", "Bridge railing"]);
  });
});

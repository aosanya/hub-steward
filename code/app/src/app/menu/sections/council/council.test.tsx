import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

const titles = ["Meetings", "Agendas & Minutes", "Resolutions", "Rules", "Committees", "Declarations of interest"];

beforeEach(() => {
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => (name === "agency_list_declarations" ? { declared: [], not_declared: [], not_declared_count: 0, total: 0, can_read_all: false } : name.endsWith("_list") || name.endsWith("_groups") ? { items: [] } : Promise.reject(new Error(`${name}: unknown tool`))));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const pathOf = (title: string) => items.find((item) => item.title === title)?.path?.() ?? "";

const showItem = (title: string) =>
  render(
    <MemoryRouter initialEntries={[pathOf(title)]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

describe("the Decisions section items", () => {
  it("lists Meetings, Agendas & Minutes, Resolutions, Rules, Committees and Declarations of interest in that order", () => {
    expect(items.map((item) => item.title)).toEqual(titles);
  });

  it("gives each item its own path under the council section", () => {
    const paths = titles.map(pathOf);

    expect(new Set(paths).size).toBe(titles.length);
    paths.forEach((path) => expect(path).toMatch(/^\/a\/[^/]+\/menu\/council\/\w+$/));
  });

  it.each(titles)("opens the %s screen from its path through routes()", async (title) => {
    showItem(title);

    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
  });
});

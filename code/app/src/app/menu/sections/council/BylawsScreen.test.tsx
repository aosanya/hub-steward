import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { BylawsScreen, bylawsTitle } from "./BylawsScreen";
import { councilTools } from "./councilData";
import { councilPaths } from "./paths";

const bylaws = [
  { id: "b1", title: "Standing Orders", year: 2021, text: "Meetings open at nine in the morning." },
  { id: "b2", title: "Code of Conduct", year: 2019, text: "Members declare any interest before a vote." },
];

const origin = { path: "/a/town/menu/council", title: "Decisions" };

let called: MockInstance<typeof mcp.callTool>;
let landed = "";
let stored: unknown[] = bylaws;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const answer = (name: string, args: unknown) => {
  if (name === councilTools.bylawList) return Promise.resolve({ items: stored });
  if (name === councilTools.bylawRead) return Promise.resolve({ item: bylaws.find((bylaw) => bylaw.id === (args as { bylawID: string }).bylawID) });
  return Promise.reject(new Error(`${name}: unknown tool`));
};

beforeEach(() => {
  stored = bylaws;
  openAgency("town");
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const showBylaws = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: councilPaths.bylaws.path(), state: { from: origin } }]}>
      <Routes>
        <Route path={councilPaths.bylaws.pattern} element={<BylawsScreen />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

describe("the Bylaws screen", () => {
  it("is titled Rules", () => {
    expect(bylawsTitle).toBe("Rules");
  });

  it("lists each bylaw by its title with its year", async () => {
    showBylaws();

    await screen.findByText("Standing Orders", { selector: ".ttl" });
    expect(screen.getByText("2021", { selector: ".meta" })).toBeInTheDocument();
    expect(screen.getByText("Code of Conduct", { selector: ".ttl" })).toBeInTheDocument();
    expect(screen.getByText("2019", { selector: ".meta" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rules" })).toBeInTheDocument();
    expect(callsTo(councilTools.bylawList)).toHaveLength(1);
  });

  it("opens the bylaw beside the list, read by its id, showing title, year and text", async () => {
    showBylaws();
    await userEvent.click(await screen.findByRole("button", { name: /Standing Orders/ }));

    await waitFor(() => expect(pane().textContent).toContain("Meetings open at nine in the morning."));
    expect(pane().textContent).toContain("Title");
    expect(pane().textContent).toContain("Standing Orders");
    expect(pane().textContent).toContain("Year");
    expect(pane().textContent).toContain("2021");
    expect(pane().textContent).toContain("Text");
    expect(callsTo(councilTools.bylawRead).map(([, , args]) => args)).toEqual([{ bylawID: "b1" }]);
  });

  it("names Rules on the Back button of an opened bylaw and returns to the list", async () => {
    showBylaws();
    await userEvent.click(await screen.findByRole("button", { name: /Standing Orders/ }));
    await waitFor(() => expect(pane()).not.toBeNull());

    await userEvent.click(screen.getByRole("button", { name: "‹ Rules" }));

    expect(document.querySelector(".mw-detail")).toBeNull();
    expect(screen.getByText("Code of Conduct")).toBeInTheDocument();
  });

  it("names the screen the person came from on the Back button of the list, and goes there", async () => {
    showBylaws();
    await screen.findByText("Standing Orders");

    await userEvent.click(screen.getByRole("button", { name: "‹ Decisions" }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("says so, with the Home button, when the hub lists no bylaws", async () => {
    stored = [];
    showBylaws();

    expect(await screen.findByText("No bylaws yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
  });
});

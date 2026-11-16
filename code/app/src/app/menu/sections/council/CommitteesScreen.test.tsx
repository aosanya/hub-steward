import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { CommitteesScreen } from "./CommitteesScreen";
import { councilPaths } from "./paths";

const groupList = "actor_list_groups";
const leaderList = "actor_list_group_leaders";

const committees = [
  { id: "g1", name: "Finance Committee", node_type: "Committee" },
  { id: "g2", name: "Planning Committee", node_type: "Committee" },
  { id: "g3", name: "Audit Committee", node_type: "Committee" },
];

const others = [
  { id: "g8", name: "Public Works Department", node_type: "Department" },
  { id: "g9", name: "Balogh household", node_type: "Háztartás" },
  { id: "g10", name: "walk-03 Town hall" },
];

const leadersOf: Record<string, unknown[]> = {
  g1: [{ actor_id: "a1", display_name: "Anna Sample" }],
  g2: [{ actor_id: "a2", display_name: "Ben Sample" }],
  g3: [],
};

const origin = { path: "/a/town/menu/council", title: "Decisions" };

let called: MockInstance<typeof mcp.callTool>;
let landed = "";
let groups: unknown[] = committees;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const answer = (name: string, args: unknown) => {
  if (name === groupList) return Promise.resolve({ items: groups });
  if (name === leaderList) return Promise.resolve({ items: leadersOf[(args as { group_id: string }).group_id] ?? [] });
  return Promise.reject(new Error(`${name}: unknown tool`));
};

beforeEach(() => {
  groups = [...others, ...committees];
  openAgency("town");
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const showCommittees = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: councilPaths.committees.path(), state: { from: origin } }]}>
      <Routes>
        <Route path={councilPaths.committees.pattern} element={<CommitteesScreen />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const rowOf = (title: string) => screen.getByText(title, { selector: ".ttl" }).closest(".row") as HTMLElement;

const metaOf = (row: HTMLElement) => Array.from(row.querySelectorAll(".meta")).map((line) => line.textContent);

describe("the Committees screen", () => {
  it("draws one row for each committee the hub lists, with its chair from actor_list_group_leaders", async () => {
    showCommittees();

    await screen.findByText("Finance Committee", { selector: ".ttl" });
    expect(await screen.findByText("Chair: Anna Sample")).toBeInTheDocument();
    expect(metaOf(rowOf("Planning Committee"))).toEqual(["Chair: Ben Sample"]);
    expect(screen.getByRole("heading", { name: "Committees" })).toBeInTheDocument();
    expect(callsTo(groupList)).toHaveLength(1);
  });

  it("leaves out every group whose type is not Committee", async () => {
    showCommittees();
    await screen.findByText("Chair: Anna Sample");

    expect(screen.queryByText("Public Works Department")).toBeNull();
    expect(screen.queryByText("Balogh household")).toBeNull();
    expect(screen.queryByText("walk-03 Town hall")).toBeNull();
    expect(callsTo(leaderList).map(([, , args]) => (args as { group_id: string }).group_id).sort()).toEqual(["g1", "g2", "g3"]);
  });

  it("draws a committee with no leader as a name alone", async () => {
    showCommittees();
    await screen.findByText("Chair: Anna Sample");

    expect(metaOf(rowOf("Audit Committee"))).toEqual([]);
  });

  it("opens the committee beside the list when a row is pressed, with its chair", async () => {
    showCommittees();
    await userEvent.click(await screen.findByRole("button", { name: /Finance Committee/ }));

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(pane().textContent).toContain("Anna Sample"));
    expect(screen.getByRole("button", { name: /Finance Committee/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Planning Committee/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("names Committees on the Back button of an opened committee and returns to the list", async () => {
    showCommittees();
    await userEvent.click(await screen.findByRole("button", { name: /Finance Committee/ }));
    await waitFor(() => expect(pane()).not.toBeNull());

    await userEvent.click(screen.getByRole("button", { name: "‹ Committees" }));

    expect(document.querySelector(".mw-detail")).toBeNull();
    expect(screen.getByText("Planning Committee")).toBeInTheDocument();
  });

  it("names the screen the person came from on the Back button of the list, and goes there", async () => {
    showCommittees();
    await screen.findByText("Chair: Anna Sample");

    await userEvent.click(screen.getByRole("button", { name: "‹ Decisions" }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("says so when the hub lists no committees", async () => {
    groups = others;
    showCommittees();

    expect(await screen.findByText(/No committees/i)).toBeInTheDocument();
  });
});

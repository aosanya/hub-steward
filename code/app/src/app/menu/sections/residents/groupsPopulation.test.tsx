import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { GroupsScreen, HouseholdsScreen } from "./PeopleScreens";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const groups = [
  { id: "g1", name: "North Ward", node_type: "Ward" },
  { id: "g2", name: "Reading Circle", node_type: "Association" },
  { id: "g3", name: "Kovacs Family", node_type: "Household" },
  { id: "g4", name: "Szabo Family", node_type: "Household" },
];

const populations: Record<string, unknown> = { g1: { group_id: "g1", population: 48 }, g4: { group_id: "g4", population: 4 } };

beforeEach(() => {
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    if (name === "actor_list_groups") return { items: groups };
    if (name === "actor_get_group_population") {
      const figure = populations[(args as { group_id: string }).group_id];
      if (figure === undefined) throw new mcp.McpError("no population figure recorded for the group");
      return figure;
    }
    throw new Error(`unexpected tool ${name}`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("a group with no recorded population figure", () => {
  it("stays in Groups & Associations with no member count while others show theirs", async () => {
    render(<MemoryRouter><GroupsScreen /></MemoryRouter>);

    expect(await screen.findByText("North Ward")).toBeInTheDocument();
    expect(screen.getByText("48 members")).toBeInTheDocument();
    expect(screen.getByText("Reading Circle")).toBeInTheDocument();
    expect(screen.queryByText("This list could not be loaded.")).toBeNull();
  });

  it("stays in Households with no member count while others show theirs", async () => {
    render(<MemoryRouter><HouseholdsScreen /></MemoryRouter>);

    expect(await screen.findByText("Szabo Family")).toBeInTheDocument();
    expect(screen.getByText("4 members")).toBeInTheDocument();
    expect(screen.getByText("Kovacs Family")).toBeInTheDocument();
    expect(screen.queryByText("This list could not be loaded.")).toBeNull();
  });
});

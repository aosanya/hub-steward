import { vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, within } from "@testing-library/react";
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
    if (name === "actor_get_group") return { item: groups.find((group) => group.id === (args as { group_id: string }).group_id) };
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

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
};

describe("choosing a group with no recorded population figure at wide size", () => {
  beforeEach(() => setWide(true));

  afterEach(() => Reflect.deleteProperty(window, "matchMedia"));

  it.each([
    { title: "Groups & Associations", screen: <GroupsScreen />, chosen: "Reading Circle" },
    { title: "Households", screen: <HouseholdsScreen />, chosen: "Kovacs Family" },
  ])("shows the name and no members row in the $title content pane", async ({ screen: view, chosen }) => {
    render(<MemoryRouter>{view}</MemoryRouter>);

    await userEvent.click(await screen.findByRole("button", { name: new RegExp(chosen) }));

    const content = document.querySelector(".wf-main .wf-content") as HTMLElement;
    expect((await within(content).findAllByText(chosen)).length).toBeGreaterThan(0);
    expect(await within(content).findByText("Hidden")).toBeInTheDocument();
    expect(within(content).queryByText("Members")).toBeNull();
    expect(within(content).queryByText(/members$/)).toBeNull();
    expect(screen.queryByText("This list could not be loaded.")).toBeNull();
  });
});

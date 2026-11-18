import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { WishesScreen } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown>;

const wishesPath = "/a/town/menu/issues/wishes";
const wishesPattern = "/a/:agencyId/menu/issues/wishes";
const listTool = "forms_catalog_board_item_list";
const tallyTool = "forms_catalog_board_item_tally_by_area";
const endorseTool = "forms_catalog_endorsement_add";

const wishes = [
  { id: "w1", title: "A bench by the bus stop", raised_by: 3, me_too: 2 },
  { id: "w2", title: "Longer library hours", raised_by: 1, me_too: 1 },
];

const tally = [
  {
    id: "w1",
    title: "A bench by the bus stop",
    areas: [
      { area: "Malomsor", raised_by: 2, me_too: 1, population: 1200 },
      { area: "Óváros", raised_by: 1, me_too: 1, population: null },
      { area: "Kertváros", raised_by: 0, me_too: 0, population: 900 },
      { area: "", raised_by: 0, me_too: 2, population: null },
    ],
  },
  { id: "w2", title: "Longer library hours", areas: [{ area: "Óváros", raised_by: 1, me_too: 1, population: 0 }] },
];

let called: MockInstance<typeof mcp.callTool>;
let answers: Record<string, (args: Args) => unknown>;

beforeEach(() => {
  openAgency("town");
  answers = { [listTool]: () => ({ items: wishes }), [tallyTool]: () => ({ items: tally }), [endorseTool]: () => ({}) };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const answer = answers[name];
    if (!answer) throw new Error(`${name} is not a tool this screen may use`);
    return answer((args ?? {}) as Args);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const open = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: wishesPath, state: { from: { path: "/a/town/menu/issues", title: "Issues & Requests" } } }]}>
      <Routes>
        <Route path={wishesPattern} element={<WishesScreen />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

const rowOf = async (title: string) => (await screen.findByText(title)).closest(".row") as HTMLElement;

describe("Wishes by area", () => {
  it("shows one line for each area that has anyone behind the wish, under that wish", async () => {
    open();
    const row = await rowOf("A bench by the bus stop");

    await waitFor(() => expect(within(row).getByText(/Malomsor/)).toBeInTheDocument());
    expect(within(row).getByText(/Malomsor.*raised by 2.*1 said Me too/)).toBeInTheDocument();
    expect(within(row).getByText(/Óváros.*raised by 1.*1 said Me too/)).toBeInTheDocument();
  });

  it("hides an area where nobody is behind the wish", async () => {
    open();
    const row = await rowOf("A bench by the bus stop");

    await waitFor(() => expect(within(row).getByText(/Malomsor/)).toBeInTheDocument());
    expect(within(row).queryByText(/Kertváros/)).toBeNull();
  });

  it("reads No area for the people nobody can place", async () => {
    open();
    const row = await rowOf("A bench by the bus stop");

    await waitFor(() => expect(within(row).getByText(/No area.*0.*raised by 0.*2 said Me too|No area.*raised by 0.*2 said Me too/)).toBeInTheDocument());
  });

  it("shows how many live there only when the population is above zero", async () => {
    open();
    const bench = await rowOf("A bench by the bus stop");
    const library = await rowOf("Longer library hours");

    await waitFor(() => expect(within(bench).getByText(/1200 live there|1,200 live there/)).toBeInTheDocument());
    expect(within(bench).queryByText(/null live there/)).toBeNull();
    expect(within(library).queryByText(/0 live there/)).toBeNull();
    expect(within(library).getByText(/Óváros.*raised by 1/)).toBeInTheDocument();
  });

  it("calls the tally once for the whole screen, without a board item id", async () => {
    open();
    await waitFor(() => expect(screen.getAllByText(/Malomsor/).length).toBeGreaterThan(0));

    const calls = called.mock.calls.filter(([, name]) => name === tallyTool);
    expect(calls).toHaveLength(1);
    expect(calls[0][2] ?? {}).not.toHaveProperty("board_item_id");
  });

  it("leaves the wishes as they are, with no area lines and no error, when the tally is refused", async () => {
    answers[tallyTool] = () => {
      throw new Error("this role may not read the tally");
    };
    open();
    const row = await rowOf("A bench by the bus stop");

    expect(within(row).getByText(/raised by 3/)).toBeInTheDocument();
    await waitFor(() => expect(called.mock.calls.some(([, name]) => name === tallyTool)).toBe(true));
    expect(within(row).queryByText(/Malomsor/)).toBeNull();
    expect(screen.queryByText(/may not read/)).toBeNull();
  });

  it("reads the tally again after a Me too", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /A bench by the bus stop/ }));
    await waitFor(() => expect(screen.getAllByText(/Malomsor/).length).toBeGreaterThan(0));
    const before = called.mock.calls.filter(([, name]) => name === tallyTool).length;

    await userEvent.click(await screen.findByRole("button", { name: /Me too/ }));

    await waitFor(() => expect(called.mock.calls.filter(([, name]) => name === tallyTool).length).toBeGreaterThan(before));
  });

  it("shows the same lines on a wide screen", async () => {
    setWide(true);
    open();
    const row = await rowOf("A bench by the bus stop");

    await waitFor(() => expect(within(row).getByText(/Malomsor.*raised by 2/)).toBeInTheDocument());
  });
});

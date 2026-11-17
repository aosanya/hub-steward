import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { WishesScreen } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown>;

const wishesPath = "/a/town/menu/issues/wishes";
const wishesPattern = "/a/:agencyId/menu/issues/wishes";
const listTool = "forms_catalog_board_item_list";
const addTool = "forms_catalog_endorsement_add";
const resident = "resident-1";

const seeded = [
  { id: "w1", title: "A bench by the bus stop", raised_by: 3, me_too: 2 },
  { id: "w2", title: "Longer library hours", raised_by: 1, me_too: 1 },
  { id: "w3", title: "A dog park", raised_by: 5, me_too: 0 },
];

const bench = "A bench by the bus stop";
const library = "Longer library hours";
const park = "A dog park";

let called: MockInstance<typeof mcp.callTool>;
let holders: Map<string, Set<string>>;
let addFails: boolean;

const meTooOf = (wish: (typeof seeded)[number]) => wish.me_too + (holders.get(wish.id)?.size ?? 0);

beforeEach(() => {
  openAgency("town");
  holders = new Map(seeded.map((wish) => [wish.id, new Set<string>()]));
  addFails = false;
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const given = (args ?? {}) as Args;
    if (name === listTool) return { items: seeded.map((wish) => ({ ...wish, me_too: meTooOf(wish) })) };
    if (name === addTool) {
      if (addFails) throw new Error("the hub said no");
      holders.get(String(given.subject_id))?.add(resident);
      return {};
    }
    throw new Error(`${name} is not a tool this screen may use`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
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

const meTooButton = (title: string) => screen.findByRole("button", { name: `Me too: ${title}` });

const addCalls = () => called.mock.calls.filter(([, name]) => name === addTool);

describe("Me too on the Wishes screen", () => {
  it("ends every wish row with a Me too button", async () => {
    open();

    for (const title of [bench, library, park]) {
      const button = await meTooButton(title);
      expect(button).toHaveTextContent("Me too");
      expect(button).toBeEnabled();
      expect(within(await rowOf(title)).getByRole("button", { name: `Me too: ${title}` })).toBe(button);
    }
  });

  it("sends one endorsement for the tapped wish", async () => {
    open();

    await userEvent.click(await meTooButton(bench));

    await waitFor(() => expect(addCalls()).toHaveLength(1));
    expect(called).toHaveBeenCalledWith("", addTool, expect.objectContaining({ subject_id: "w1" }));
  });

  it("raises the tapped wish's count by exactly one and leaves the other rows alone", async () => {
    open();
    const row = await rowOf(bench);
    expect(within(row).getByText(/2 said Me too/)).toBeInTheDocument();

    await userEvent.click(await meTooButton(bench));

    await waitFor(() => expect(within(row).getByText(/3 said Me too/)).toBeInTheDocument());
    expect(within(await rowOf(library)).getByText(/(?<!\d)1 said Me too/)).toBeInTheDocument();
    expect(within(await rowOf(park)).getByText(/0 said Me too/)).toBeInTheDocument();
  });

  it("reads the count from a fresh list, not from the add reply", async () => {
    open();
    await userEvent.click(await meTooButton(bench));

    await waitFor(() => expect(called.mock.calls.filter(([, name]) => name === listTool).length).toBeGreaterThan(1));
  });

  it("turns the tapped button into a disabled You said Me too", async () => {
    open();

    await userEvent.click(await meTooButton(bench));

    const done = await screen.findByRole("button", { name: /You said Me too/ });
    expect(done).toBeDisabled();
    expect(within(await rowOf(bench)).getByRole("button", { name: /You said Me too/ })).toBe(done);
    expect(await meTooButton(library)).toBeEnabled();
  });

  it("offers the button again on a new visit and keeps the count when the same resident taps again", async () => {
    open();
    await userEvent.click(await meTooButton(bench));
    await screen.findByText(/3 said Me too/);
    cleanup();

    open();
    const again = await meTooButton(bench);
    expect(again).toBeEnabled();
    expect(within(await rowOf(bench)).getByText(/3 said Me too/)).toBeInTheDocument();
    await userEvent.click(again);

    await waitFor(() => expect(addCalls()).toHaveLength(2));
    expect(addCalls()[1]).toEqual(["", addTool, expect.objectContaining({ subject_id: "w1" })]);
    await waitFor(() => expect(within(screen.getByText(bench).closest(".row") as HTMLElement).getByText(/3 said Me too/)).toBeInTheDocument());
    expect(screen.queryByText(/4 said Me too/)).toBeNull();
  });

  it("says the Me too could not be sent in that row, keeps the count and enables the button again", async () => {
    addFails = true;
    open();
    const row = await rowOf(bench);

    await userEvent.click(await meTooButton(bench));

    const alert = await within(row).findByRole("alert");
    expect(alert).toHaveTextContent("Your Me too could not be sent.");
    expect(within(row).getByText(/2 said Me too/)).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: `Me too: ${bench}` })).toBeEnabled();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});

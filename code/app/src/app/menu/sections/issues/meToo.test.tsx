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

const listRowOf = async (title: string) => (await screen.findByText(title, { selector: ".mw-list .ttl" })).closest(".row") as HTMLElement;

const chooseWish = async (title: string) => {
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(title) }));
  await waitFor(() => expect(document.querySelector(".mw-detail")).not.toBeNull());
  return document.querySelector(".mw-detail") as HTMLElement;
};

const meTooIn = (pane: HTMLElement, title: string) => within(pane).findByRole("button", { name: `Me too: ${title}` });

const saidCountIn = (pane: HTMLElement) => (within(pane).getByText("Said Me too").closest(".txt") as HTMLElement).textContent;

const addCalls = () => called.mock.calls.filter(([, name]) => name === addTool);

describe("Me too on the Wishes screen", () => {
  it("offers a Me too button in the pane of the chosen wish, and none on the rows", async () => {
    open();
    await screen.findByText(bench);
    expect(screen.queryByRole("button", { name: /^Me too/ })).toBeNull();

    const pane = await chooseWish(bench);

    const button = await meTooIn(pane, bench);
    expect(button).toHaveTextContent("Me too");
    expect(button).toBeEnabled();
  });

  it("sends one endorsement for the chosen wish", async () => {
    open();
    const pane = await chooseWish(bench);

    await userEvent.click(await meTooIn(pane, bench));

    await waitFor(() => expect(addCalls()).toHaveLength(1));
    expect(called).toHaveBeenCalledWith("", addTool, expect.objectContaining({ subject_id: "w1" }));
  });

  it("raises the chosen wish's count by exactly one in the pane and the list, and leaves the other rows alone", async () => {
    open();
    const pane = await chooseWish(bench);
    expect(within(await listRowOf(bench)).getByText(/2 said Me too/)).toBeInTheDocument();

    await userEvent.click(await meTooIn(pane, bench));

    await waitFor(() => expect(saidCountIn(document.querySelector(".mw-detail") as HTMLElement)).toBe("Said Me too3"));
    expect(within(await listRowOf(bench)).getByText(/3 said Me too/)).toBeInTheDocument();
    expect(within(await listRowOf(library)).getByText(/(?<!\d)1 said Me too/)).toBeInTheDocument();
    expect(within(await listRowOf(park)).getByText(/0 said Me too/)).toBeInTheDocument();
  });

  it("reads the count from a fresh list, not from the add reply", async () => {
    open();
    const pane = await chooseWish(bench);
    await userEvent.click(await meTooIn(pane, bench));

    await waitFor(() => expect(called.mock.calls.filter(([, name]) => name === listTool)).toHaveLength(2));
  });

  it("turns the pressed button into a disabled You said Me too", async () => {
    open();
    const pane = await chooseWish(bench);

    await userEvent.click(await meTooIn(pane, bench));

    const done = await screen.findByRole("button", { name: /You said Me too/ });
    expect(done).toBeDisabled();
    expect(done.closest(".mw-detail")).not.toBeNull();
  });

  it("offers the button again on a new visit and keeps the count when the same resident presses again", async () => {
    open();
    const first = await chooseWish(bench);
    await userEvent.click(await meTooIn(first, bench));
    await within(await listRowOf(bench)).findByText(/3 said Me too/);
    cleanup();

    open();
    const pane = await chooseWish(bench);
    const again = await meTooIn(pane, bench);
    expect(again).toBeEnabled();
    expect(within(await listRowOf(bench)).getByText(/3 said Me too/)).toBeInTheDocument();
    await userEvent.click(again);

    await waitFor(() => expect(addCalls()).toHaveLength(2));
    expect(addCalls()[1]).toEqual(["", addTool, expect.objectContaining({ subject_id: "w1" })]);
    await waitFor(() => expect(saidCountIn(document.querySelector(".mw-detail") as HTMLElement)).toBe("Said Me too3"));
    expect(screen.queryByText(/4 said Me too/)).toBeNull();
  });

  it("says the Me too could not be sent in the pane, keeps the count and enables the button again", async () => {
    addFails = true;
    open();
    const pane = await chooseWish(bench);

    await userEvent.click(await meTooIn(pane, bench));

    const alert = await within(pane).findByRole("alert");
    expect(alert).toHaveTextContent("Your Me too could not be sent.");
    expect(within(await listRowOf(bench)).getByText(/2 said Me too/)).toBeInTheDocument();
    expect(within(pane).getByRole("button", { name: `Me too: ${bench}` })).toBeEnabled();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  describe("on a wide screen", () => {
    beforeEach(() => setWide(true));

    afterEach(() => forgetWidth());

    it("sends the Me too from the right pane and shows the new count there", async () => {
      open();
      await userEvent.click(await screen.findByRole("button", { name: new RegExp(library) }));
      const main = document.querySelector(".wf-main") as HTMLElement;

      await userEvent.click(await meTooIn(main, library));

      await waitFor(() => expect(addCalls()).toHaveLength(1));
      expect(called).toHaveBeenCalledWith("", addTool, expect.objectContaining({ subject_id: "w2" }));
      await waitFor(() => expect(saidCountIn(document.querySelector(".wf-main") as HTMLElement)).toBe("Said Me too2"));
      expect(within(document.querySelector(".wf-main") as HTMLElement).getByRole("button", { name: /You said Me too/ })).toBeDisabled();
    });
  });
});

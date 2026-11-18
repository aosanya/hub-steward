import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { WishesScreen, items } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown>;

const wishesPath = "/a/town/menu/issues/wishes";
const wishesPattern = "/a/:agencyId/menu/issues/wishes";
const tool = "forms_catalog_board_item_list";

const wishes = [
  { id: "w1", title: "A bench by the bus stop", raised_by: 3, me_too: 2 },
  { id: "w2", title: "Longer library hours", raised_by: 1, me_too: 1 },
  { id: "w3", title: "A dog park", raised_by: 5, me_too: 0 },
];

let called: MockInstance<typeof mcp.callTool>;
let answers: Record<string, (args: Args) => unknown>;

beforeEach(() => {
  openAgency("town");
  answers = { [tool]: () => ({ items: wishes }) };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const answer = answers[name];
    if (!answer) throw new Error(`${name} is not a tool this screen may use`);
    return answer((args ?? {}) as Args);
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

const pathOf = (item: { path: unknown }) => (typeof item.path === "function" ? (item.path as () => string)() : String(item.path));

describe("the Issues & Requests section's menu", () => {
  it("lists Wishes, pointing at the wishes path", () => {
    expect(items.map((item) => item.title)).toContain("Wishes");
    const wishesItem = items.find((item) => item.title === "Wishes");
    expect(wishesItem && pathOf(wishesItem)).toBe(wishesPath);
  });
});

describe("Wishes", () => {
  it("is titled Wishes", async () => {
    open();

    expect(await screen.findByRole("heading", { name: "Wishes" })).toBeInTheDocument();
  });

  it("asks the board item list tool for the wishes", async () => {
    open();
    await screen.findByText("A bench by the bus stop");

    expect(called).toHaveBeenCalledWith("", tool, expect.anything());
  });

  it("draws one row for each wish with its title", async () => {
    open();

    expect(await screen.findByText("A bench by the bus stop")).toBeInTheDocument();
    expect(screen.getByText("Longer library hours")).toBeInTheDocument();
    expect(screen.getByText("A dog park")).toBeInTheDocument();
  });

  it("shows how many people raised a wish and how many said Me too", async () => {
    open();
    await screen.findByText("A bench by the bus stop");

    expect(screen.getByText(/raised by 3/)).toBeInTheDocument();
    expect(screen.getByText(/2 said Me too/)).toBeInTheDocument();
  });

  it("reads raised by 1 and 1 said Me too for a wish with a single person each way", async () => {
    open();
    await screen.findByText("Longer library hours");

    expect(screen.getByText(/raised by 1(?!\d)/)).toBeInTheDocument();
    expect(screen.getByText(/(?<!\d)1 said Me too/)).toBeInTheDocument();
  });

  it("shows a zero count for a wish nobody said Me too to", async () => {
    open();
    await screen.findByText("A dog park");

    expect(screen.getByText(/raised by 5/)).toBeInTheDocument();
    expect(screen.getByText(/0 said Me too/)).toBeInTheDocument();
  });

  it("shows the empty state as a card with the Home button inside it when there are no wishes", async () => {
    answers[tool] = () => ({ items: [] });
    open();

    await waitFor(() => expect(document.querySelector(".card button")).not.toBeNull());
    const card = (document.querySelector(".card button") as HTMLElement).closest(".card") as HTMLElement;
    expect(within(card).getByText("No wishes yet.")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(card.querySelector("svg, img")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});

describe("Wishes opens the chosen wish", () => {
  const choose = async (title: string) => userEvent.click(await screen.findByRole("button", { name: new RegExp(title) }));

  it("opens the wish on a phone from its row, with its title, how many raised it and how many said Me too", async () => {
    open();
    await choose("A bench by the bus stop");

    expect(document.querySelector(".mw")).toHaveAttribute("data-chosen", "yes");
    const detail = document.querySelector(".mw-detail") as HTMLElement;
    expect(await within(detail).findByText("A bench by the bus stop")).toBeInTheDocument();
    expect(within(detail).getByText("Raised by")).toBeInTheDocument();
    expect(within(detail).getByText("3")).toBeInTheDocument();
    expect(within(detail).getByText("Said Me too")).toBeInTheDocument();
    expect(within(detail).getByText("2")).toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "Me too: A bench by the bus stop" })).toBeEnabled();
  });

  it("reads the chosen wish from the list it already loaded", async () => {
    open();
    await choose("A dog park");
    await within(document.querySelector(".mw-detail") as HTMLElement).findByText("Raised by");

    expect(called.mock.calls.map(([, name]) => name)).toEqual([tool, "forms_catalog_board_item_tally_by_area"]);
  });

  describe("on a wide screen", () => {
    beforeEach(() => setWide(true));

    afterEach(() => forgetWidth());

    it("keeps the list on the left, opens the chosen wish in the right pane and draws no tab bar", async () => {
      open();
      await choose("Longer library hours");

      const main = document.querySelector(".wf-main") as HTMLElement;
      expect(await within(main).findByText("Raised by")).toBeInTheDocument();
      expect(within(main).getByText("Longer library hours")).toBeInTheDocument();
      expect(within(main).getByRole("button", { name: "Me too: Longer library hours" })).toBeInTheDocument();
      expect(within(document.querySelector(".wf-tree") as HTMLElement).getByRole("button", { name: /A dog park/ })).toBeInTheDocument();
      expect(document.querySelector("nav.tabs")).toBeNull();
    });

    it("opens the first wish in the right pane without a tap", async () => {
      open();
      await screen.findByText("A dog park");

      const main = document.querySelector(".wf-main") as HTMLElement;
      expect(await within(main).findByText("Raised by")).toBeInTheDocument();
      expect(within(main).getByText("A bench by the bus stop")).toBeInTheDocument();
      const tree = document.querySelector(".wf-tree") as HTMLElement;
      expect(within(tree).getByRole("button", { name: /A bench by the bus stop/ })).toHaveAttribute("aria-pressed", "true");
    });
  });
});

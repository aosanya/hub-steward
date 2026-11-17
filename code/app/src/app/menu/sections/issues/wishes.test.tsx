import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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

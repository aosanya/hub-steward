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

const bench = "A bench by the bus stop";
const library = "Longer library hours";

const wishes = [
  { id: "w1", title: bench, kind: "idea", raised_by: 3, me_too: 2 },
  { id: "w2", title: library, raised_by: 1, me_too: 1 },
];

const tally = [
  {
    id: "w1",
    areas: [
      { area: "Malomsor", raised_by: 2, me_too: 1, population: 1200 },
      { area: "Kertváros", raised_by: 0, me_too: 0, population: 900 },
      { area: "Óváros", raised_by: 1, me_too: 0, population: 0 },
    ],
  },
  { id: "w2", areas: [] },
];

let called: MockInstance<typeof mcp.callTool>;
let answers: Record<string, (args: Args) => unknown>;

beforeEach(() => {
  openAgency("town");
  setWide(true);
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

const pageOf = async () => {
  open();
  await screen.findByRole("heading", { level: 1, name: bench });
  return document.querySelector(".mw-detail") as HTMLElement;
};

describe("a wish's page is built like the resident page", () => {
  it("has the wish as the title, its kind and counts on one quiet line, and no header band", async () => {
    const page = await pageOf();

    expect(within(page).getByRole("heading", { level: 1, name: bench })).toBeInTheDocument();
    expect(page.querySelector(".quiet-line")?.textContent).toBe("Idea · Raised by 3 · 2 said Me too");
    expect(document.querySelector(".wf-head")).toBeNull();
  });

  it("draws the main tab bar on a wide screen", async () => {
    await pageOf();

    const bar = await screen.findByRole("navigation", { name: "Main" });
    expect(within(bar).getByRole("link", { name: /Chat/ })).toBeInTheDocument();
  });

  it("holds Kind, Raised by and Said Me too as plain rows in a Wish card with Me too in its footer", async () => {
    const page = await pageOf();

    const card = within(page).getByRole("region", { name: "Wish" });
    expect(within(card).getByText("Kind")).toBeInTheDocument();
    expect(within(card).getByText("Idea", { selector: ".meta" })).toBeInTheDocument();
    expect((within(card).getByText("Raised by").closest(".txt") as HTMLElement).textContent).toBe("Raised by3");
    expect((within(card).getByText("Said Me too").closest(".txt") as HTMLElement).textContent).toBe("Said Me too2");
    expect(card.querySelector(".lead")).toBeNull();
    const foot = card.querySelector(".sec-foot") as HTMLElement;
    expect(within(foot).getByRole("button", { name: `Me too: ${bench}` })).toHaveTextContent("Me too");
    expect(within(page).queryAllByRole("button", { name: /^Me too/ })).toHaveLength(1);
  });

  it("leaves the Kind row out for a wish with no kind", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(library) }));

    const page = document.querySelector(".mw-detail") as HTMLElement;
    const card = await within(page).findByRole("region", { name: "Wish" });
    expect(within(card).queryByText("Kind")).toBeNull();
    expect(page.querySelector(".quiet-line")?.textContent).toBe("Raised by 1 · 1 said Me too");
  });
});

describe("Me too in the Wish card footer", () => {
  it("sends one endorsement for the wish and turns into a disabled You said Me too in the footer", async () => {
    const page = await pageOf();

    await userEvent.click(within(page).getByRole("button", { name: `Me too: ${bench}` }));

    await waitFor(() => expect(called.mock.calls.filter(([, name]) => name === endorseTool)).toHaveLength(1));
    expect(called).toHaveBeenCalledWith("", endorseTool, expect.objectContaining({ subject_id: "w1" }));
    const done = await screen.findByRole("button", { name: /You said Me too/ });
    expect(done).toBeDisabled();
    expect(done.closest(".sec-foot")).not.toBeNull();
  });

  it("says the Me too could not be sent and enables the button again", async () => {
    answers[endorseTool] = () => {
      throw new Error("the hub said no");
    };
    const page = await pageOf();

    await userEvent.click(within(page).getByRole("button", { name: `Me too: ${bench}` }));

    expect(await within(page).findByRole("alert")).toHaveTextContent("Your Me too could not be sent.");
    expect(within(page).getByRole("button", { name: `Me too: ${bench}` })).toBeEnabled();
  });
});

describe("an Areas card on the wish's page", () => {
  it("draws each area with anyone behind the wish as a media-object row: its count as a tag and how many live there as the lighter line", async () => {
    const page = await pageOf();

    const card = await within(page).findByRole("region", { name: "Areas" });
    const row = within(card).getByText("Malomsor").closest(".row") as HTMLElement;
    expect(row.querySelector(".lead")).not.toBeNull();
    expect(within(row).getByText("1200 live there")).toBeInTheDocument();
    expect(within(row).getByText("raised by 2 · 1 said Me too")).toBeInTheDocument();
    expect(within(card).queryByText("Kertváros")).toBeNull();
  });

  it("draws no Areas card for a wish with no area counts, and none when the tally is refused", async () => {
    answers[tallyTool] = () => {
      throw new Error("this role may not read the tally");
    };
    const page = await pageOf();

    await waitFor(() => expect(called.mock.calls.some(([, name]) => name === tallyTool)).toBe(true));
    expect(within(page).queryByRole("region", { name: "Areas" })).toBeNull();
    expect(within(page).getByRole("region", { name: "Wish" })).toBeInTheDocument();
  });
});

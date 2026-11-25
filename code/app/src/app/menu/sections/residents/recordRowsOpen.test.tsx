import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { servedAsHub } from "../../registerHub.test-support";
import { routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Row = { id: string; answers: Record<string, string> };

const screens: { name: string; code: string; path: () => string; rows: Row[]; other: string; add: string }[] = [
  {
    name: "Businesses",
    code: "RC-1",
    path: () => residentPaths.businesses.path(),
    rows: [
      {
        id: "b1",
        answers: { "Trading name": "Malomsor Bakery", "Kind of business": "Bakery", "Tax number": "10000000-1-01", "Registration number": "REG-4471", Place: "Mill street 4", Neighbourhood: "Malomsor", Status: "Active" },
      },
      { id: "b2", answers: { "Trading name": "Zöldkert Grocer", "Kind of business": "Grocer", "Tax number": "20000000-2-02", Neighbourhood: "Óváros", Status: "Suspended" } },
    ],
    other: "20000000-2-02",
    add: "Add business",
  },
  {
    name: "Informal traders",
    code: "RC-2",
    path: () => residentPaths.informalTraders.path(),
    rows: [
      {
        id: "t1",
        answers: { "Name or alias": "Marika's flower stand", "Kind of trader": "Stall holder at the market", "What is sold": "Flowers", "Usual place": "Market square", "Usual days": "Saturday", Neighbourhood: "Óváros", Status: "Active" },
      },
      { id: "t2", answers: { "Name or alias": "Ferenc the chestnut roaster", "Kind of trader": "Street seller", "What is sold": "Roasted chestnuts", "Usual place": "Station steps", Neighbourhood: "Határrét", Status: "Suspended" } },
    ],
    other: "Station steps",
    add: "Add trader",
  },
];

const recordNames: Record<string, string> = { "RC-1": "Businesses", "RC-2": "Informal traders" };

const listRows = (code: string, rows: unknown[]) =>
  servedAsHub(vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    if (name === "agency_list_live_records") return { items: [{ code, name: recordNames[code], can_add_rows: true }] };
    if (name === "agency_list_live_record_rows" && (args as { record_code?: string }).record_code === code) return { items: rows };
    return { items: [] };
  }));

const showScreen = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

const expectEveryAnswer = (pane: HTMLElement, answers: Record<string, string>) => {
  Object.entries(answers).forEach(([prompt, answer]) => {
    expect(within(pane).getByText(prompt)).toBeInTheDocument();
    expect(within(pane).getAllByText(answer).length).toBeGreaterThan(0);
  });
};

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

describe.each(screens)("the $name rows", ({ code, path, rows, other, add }) => {
  const first = rows[0];
  const firstTitle = Object.values(first.answers)[0];

  it("keep the Add button above Search while there are rows", async () => {
    setWide(false);
    listRows(code, rows);
    showScreen(path());

    await screen.findByText(firstTitle, { selector: ".ttl" });
    expect(await screen.findByRole("button", { name: add })).toBeInTheDocument();
  });

  it("open the listed record as a page of its own on a phone", async () => {
    setWide(false);
    listRows(code, rows);
    showScreen(path());

    await userEvent.click(await screen.findByText(firstTitle, { selector: ".ttl" }));

    const detail = document.querySelector(".mw-detail") as HTMLElement;
    expect(detail).not.toBeNull();
    expectEveryAnswer(detail, first.answers);
    expect(within(detail).queryByText(other)).toBeNull();
  });

  it("open the listed record in the right pane on a wide screen", async () => {
    setWide(true);
    listRows(code, rows);
    showScreen(path());

    await userEvent.click(await screen.findByText(firstTitle, { selector: ".ttl" }));

    const content = document.querySelector(".wf .wf-main .wf-content") as HTMLElement;
    expect(content).not.toBeNull();
    expect(await within(content).findByText(Object.keys(first.answers)[0])).toBeInTheDocument();
    expectEveryAnswer(content, first.answers);
    expect(within(content).queryByText(other)).toBeNull();
  });

  it("never print the owner or holder person id in the opened record", async () => {
    setWide(false);
    const answers = { ...first.answers, [code === "RC-1" ? "Owner" : "Holder"]: "7d3c9a52-1b44-4f0e-9a37-5c1e8b2f6d10" };
    listRows(code, [{ ...first, answers }]);
    showScreen(path());

    await userEvent.click(await screen.findByText(firstTitle, { selector: ".ttl" }));

    const detail = document.querySelector(".mw-detail") as HTMLElement;
    expectEveryAnswer(detail, first.answers);
    expect(within(detail).queryByText("7d3c9a52-1b44-4f0e-9a37-5c1e8b2f6d10")).toBeNull();
  });
});

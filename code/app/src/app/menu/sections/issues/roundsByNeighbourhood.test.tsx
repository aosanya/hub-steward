import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { RoundsByNeighbourhoodScreen } from "./RoundsByNeighbourhoodScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const year = new Date().getFullYear();
const lastYear = year - 1;

const groups = [
  { id: "g-mal", name: "Malomsor", node_type: "Városrész" },
  { id: "g-ova", name: "Óváros", node_type: "Városrész" },
  { id: "g-ker", name: "Kertváros", node_type: "Városrész" },
  { id: "g-fam", name: "Kovacs Family", node_type: "Háztartás" },
];

const levels = [
  { id: "l1", name: "Város", depth: 0 },
  { id: "l2", name: "Városrész", depth: 1, is_area: true },
  { id: "l3", name: "Háztartás", depth: 2 },
];

const forms = [
  { id: "f1", title: "Park lighting", status: "closed", published_at: `${year}-02-10T09:00:00Z` },
  { id: "f2", title: "Market day", status: "published", published_at: `${year}-05-02T09:00:00Z` },
  { id: "f3", title: "Old round", status: "closed", published_at: `${lastYear}-03-01T09:00:00Z` },
];

const reached: Record<string, string[]> = { f1: ["g-mal", "g-ova"], f2: ["g-mal"], f3: ["g-mal", "g-ova", "g-ker"] };

const sends: Record<string, { member_id: string; chapter_id: string }[]> = {
  f1: [
    { member_id: "m1", chapter_id: "g-mal" },
    { member_id: "m2", chapter_id: "g-mal" },
    { member_id: "m3", chapter_id: "g-ova" },
  ],
  f2: [
    { member_id: "m1", chapter_id: "g-mal" },
    { member_id: "m4", chapter_id: "g-mal" },
  ],
  f3: [{ member_id: "m9", chapter_id: "g-ker" }],
};

const populations: Record<string, number> = { "g-mal": 8, "g-ova": 12 };

let called: MockInstance<typeof mcp.callTool>;
let formsAnswer: unknown;
let groupsAnswer: unknown;
let levelsAnswer: unknown;

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

beforeEach(() => {
  openAgency("town");
  formsAnswer = { rows: forms.map((form) => ({ form, questions: 3, respondents: 2 })), total: forms.length };
  groupsAnswer = { items: groups };
  levelsAnswer = { items: levels };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const formId = (args as { form_id?: string } | undefined)?.form_id ?? "";
    if (name === "actor_list_groups") return groupsAnswer;
    if (name === "actor_list_levels") return levelsAnswer;
    if (name === "forms_form_list") return formsAnswer;
    if (name === "forms_propagation_list") return { items: (reached[formId] ?? []).map((chapter_id) => ({ form_id: formId, chapter_id })) };
    if (name === "forms_submission_list") return { items: sends[formId] ?? [] };
    if (name === "actor_get_group_population") {
      const figure = populations[(args as { group_id: string }).group_id];
      if (figure === undefined) throw new mcp.McpError("no population figure recorded for the group");
      return { population: figure };
    }
    if (name === "agency_get_agency") return { name: "Zoldhalom" };
    if (name === "agency_list_mounts") return { modules: [] };
    throw new Error(`${name} is not a tool this screen may use`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  Reflect.deleteProperty(window, "matchMedia");
  vi.restoreAllMocks();
});

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

const open = (wide = false) => {
  setWide(wide);
  return render(
    <MemoryRouter initialEntries={["/a/town/menu/issues/rounds-by-neighbourhood"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/issues/rounds-by-neighbourhood" element={<RoundsByNeighbourhoodScreen />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("Rounds by Neighbourhood", () => {
  it("lists one row per neighbourhood with the rounds asked this year, who answered out of how many, and the share", async () => {
    open();

    expect(await screen.findByText("Malomsor")).toBeInTheDocument();
    expect(screen.getByText("Asked 2 · Answered 3 of 8 · 38%")).toBeInTheDocument();
    expect(screen.getByText("Asked 1 · Answered 1 of 12 · 8%")).toBeInTheDocument();
    expect(screen.queryByText("Kovacs Family")).toBeNull();
    expect(screen.getByRole("heading", { name: "Rounds by Neighbourhood" })).toBeInTheDocument();
  });

  it("leaves out the rounds of other years", async () => {
    open();

    expect(await screen.findByText("Kertváros")).toBeInTheDocument();
    expect(screen.getByText("Asked 0 · Answered 0")).toBeInTheDocument();
  });

  it("opens a neighbourhood with its name, rounds asked, answered, population and share", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Malomsor/ }));

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(pane().textContent).toContain("38%"));
    expect(pane().textContent).toContain("Malomsor");
    expect(pane().textContent).toContain("8");
  });

  it("opens the first neighbourhood by itself on a wide screen", async () => {
    open(true);

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(pane().textContent).toContain("Malomsor"));
    expect(pane().textContent).toContain("38%");
  });

  it("finds the neighbourhoods by the level the agency marks as an area, whatever it calls that level", async () => {
    levelsAnswer = { items: [{ id: "l9", name: "Háztartás", depth: 2, is_area: true }] };
    open();

    expect(await screen.findByText("Kovacs Family")).toBeInTheDocument();
    expect(screen.queryByText("Malomsor")).toBeNull();
  });

  it("says plainly that no neighbourhoods are set up when the hub lists none", async () => {
    groupsAnswer = { items: [groups[3]] };
    open();

    expect(await screen.findByText("No neighbourhoods yet.")).toBeInTheDocument();
  });

  it("reads each form's reach and sends once, however many neighbourhoods there are", async () => {
    open();
    await screen.findByText("Malomsor");

    expect(called.mock.calls.filter(([, tool]) => tool === "forms_form_list")).toHaveLength(1);
    expect(called.mock.calls.filter(([, tool]) => tool === "forms_propagation_list")).toHaveLength(2);
    expect(called.mock.calls.filter(([, tool]) => tool === "forms_submission_list")).toHaveLength(2);
  });
});

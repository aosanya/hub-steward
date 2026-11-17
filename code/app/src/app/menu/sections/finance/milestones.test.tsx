import { vi, type MockInstance } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { BudgetScreen } from "./BudgetScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown> | undefined;

const origin = { path: "/a/town/menu/finance", title: "Finance" };

const lines = [
  { id: "b1", name: "Sample Road Repairs", department: "Public Works", account_id: "ac1", period_start: "2026-01-01", period_end: "2026-02-01", planned: 1000, spent: 250 },
  { id: "b2", name: "Sample Library Books", department: "Library", account_id: "ac2", period_start: "2026-01-01", period_end: "2026-02-01", planned: 12500, spent: 0 },
  { id: "b3", name: "Sample Park Benches", department: "Parks", account_id: "ac5", period_start: "2026-01-01", period_end: "2026-02-01", planned: 800, spent: 0 },
];

const accounts = [
  { id: "ac1", code: "5000", category: "roads", type: "expense" },
  { id: "ac2", code: "5100", category: "books", type: "expense" },
  { id: "ac3", name: "Útépítő Kft.", category: "suppliers", type: "liability" },
  { id: "ac4", name: "Retention held", category: "retention", type: "liability" },
  { id: "ac5", code: "5200", category: "parks", type: "expense" },
];

const milestones = [
  { id: "m1", account_id: "ac1", contract_id: "k1", name: "Base course laid", amount: 600, due_at: "2026-03-15T00:00:00Z", status: "part_certified", certified_amount: 400 },
  { id: "m2", account_id: "ac1", contract_id: "k1", name: "Surface sealed", amount: 400, due_at: "2026-04-30T00:00:00Z", status: "planned", certified_amount: 0 },
  { id: "m3", account_id: "ac1", contract_id: "k1", name: "Kerbs set", amount: 200, due_at: "2026-02-20T00:00:00Z", status: "certified", certified_amount: 200 },
  { id: "m4", account_id: "ac5", contract_id: "k2", name: "Benches delivered", amount: 800, due_at: "2026-05-01T00:00:00Z", status: "planned", certified_amount: 0 },
];

const certificates = [
  {
    id: "c1",
    milestone_id: "m1",
    payee_account_id: "ac3",
    retention_account_id: "ac4",
    amount: 300,
    retention_bps: 1000,
    retention_amount: 30,
    certified_at: "2026-02-10T00:00:00Z",
    release_due_at: "2026-04-10T00:00:00Z",
    released_at: "2026-04-12T00:00:00Z",
  },
  {
    id: "c2",
    milestone_id: "m1",
    payee_account_id: "ac3",
    retention_account_id: "ac4",
    amount: 100,
    retention_bps: 1000,
    retention_amount: 10,
    certified_at: "2026-02-20T00:00:00Z",
    release_due_at: "2026-05-20T00:00:00Z",
  },
  {
    id: "c3",
    milestone_id: "m3",
    payee_account_id: "ac3",
    retention_account_id: "ac4",
    amount: 200,
    retention_bps: 500,
    retention_amount: 10,
    certified_at: "2026-02-18T00:00:00Z",
    release_due_at: "2026-06-18T00:00:00Z",
  },
];

const roadMilestones = {
  base: "Base course laid · 600 · due 2026-03-15 · part certified · 400 certified",
  surface: "Surface sealed · 400 · due 2026-04-30 · planned · 0 certified",
  kerbs: "Kerbs set · 200 · due 2026-02-20 · certified · 200 certified",
};

const roadCertificates = {
  released: "Base course laid · 300 certified · Útépítő Kft. · 30 withheld · released",
  waiting: "Base course laid · 100 certified · Útépítő Kft. · 10 withheld · can be released 2026-05-20",
  kerbs: "Kerbs set · 200 certified · Útépítő Kft. · 10 withheld · can be released 2026-06-18",
};

let called: MockInstance<typeof mcp.callTool>;
let words: Record<string, string>;
let milestonesOf: (accountID: string) => unknown[];

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const answers: Record<string, (args: Args) => unknown> = {
  agency_get_my_roles: () => ({ permissions: ["accounting.manage", "accounting.view"] }),
  agency_get_agency: () => ({ name: "Zoldhalom" }),
  agency_list_mounts: () => ({ modules: [{ module: "accounting", mounts: [{ name: "Finance", key: "finance", words }] }] }),
  accounting_budget_list: () => ({ items: lines }),
  accounting_budget_read: (args) => lines.find((line) => line.id === args?.budgetID) ?? {},
  accounting_account_list: () => ({ items: accounts }),
  accounting_tender_list: () => ({ items: [] }),
  accounting_milestone_list: (args) => ({ items: milestonesOf(String(args?.accountID)) }),
  accounting_certificate_list: (args) => ({ items: certificates.filter((certificate) => certificate.milestone_id === args?.milestoneID) }),
};

beforeEach(() => {
  openAgency("town");
  words = {};
  milestonesOf = (accountID) => milestones.filter((milestone) => milestone.account_id === accountID);
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    if (!answers[name]) throw new Error(`${name} is not a tool this screen may use`);
    return answers[name](args as Args);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const open = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/finance/budget", state: { from: origin } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/budget" element={<BudgetScreen />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

const openLine = async (name: RegExp) => {
  open();
  await userEvent.click(await screen.findByRole("button", { name }));
  await waitFor(() => expect(pane()).not.toBeNull());
};

const openRoadLine = async () => {
  await openLine(/Sample Road Repairs/);
  await waitFor(() => expect(pane().textContent).toContain("Public Works"));
};

describe("a budget line's milestones", () => {
  it("reads the milestones of the line's own account and nothing else", async () => {
    await openRoadLine();

    await waitFor(() => expect(callsTo("accounting_milestone_list")).toHaveLength(1));
    expect(callsTo("accounting_milestone_list")[0][2]).toEqual({ accountID: "ac1" });
  });

  it("shows a Milestones field", async () => {
    await openRoadLine();

    await waitFor(() => expect(pane().textContent).toContain("Milestones"));
  });

  it("draws one entry for each milestone with its name, value, due day, status in words and the amount certified so far", async () => {
    await openRoadLine();

    await waitFor(() => expect(pane().textContent).toContain(roadMilestones.base));
    expect(pane().textContent).toContain(roadMilestones.surface);
    expect(pane().textContent).toContain(roadMilestones.kerbs);
  });

  it("says part certified, not part_certified, for a milestone certified in part", async () => {
    await openRoadLine();

    await waitFor(() => expect(pane().textContent).toContain("part certified"));
    expect(pane().textContent).not.toContain("part_certified");
  });

  it("lists the milestones oldest first, as the tool gives them", async () => {
    await openRoadLine();

    await waitFor(() => expect(pane().textContent).toContain(roadMilestones.kerbs));
    const shown = pane().textContent ?? "";
    expect(shown.indexOf(roadMilestones.base)).toBeLessThan(shown.indexOf(roadMilestones.surface));
    expect(shown.indexOf(roadMilestones.surface)).toBeLessThan(shown.indexOf(roadMilestones.kerbs));
  });

  it("draws no Milestones field for a line whose account has no milestones, as a line without tenders shows no Tenders", async () => {
    await openLine(/Sample Library Books/);

    await waitFor(() => expect(callsTo("accounting_milestone_list")).toHaveLength(1));
    expect(callsTo("accounting_milestone_list")[0][2]).toEqual({ accountID: "ac2" });
    await waitFor(() => expect(pane().textContent).toContain("12,500"));
    expect(pane().textContent).not.toContain("Milestones");
    expect(pane().textContent).not.toContain("Payment certificates");
  });

  it("shows the milestones of the line opened, not those of the line opened before it", async () => {
    await openRoadLine();
    await waitFor(() => expect(pane().textContent).toContain(roadMilestones.base));

    await userEvent.click(screen.getByRole("button", { name: /‹ Budget$/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Sample Park Benches/ }));

    await waitFor(() => expect(pane().textContent).toContain("Benches delivered · 800 · due 2026-05-01 · planned · 0 certified"));
    expect(pane().textContent).not.toContain("Base course laid");
  });
});

describe("a budget line's payment certificates", () => {
  it("reads the certificates of each milestone by its id", async () => {
    await openRoadLine();

    await waitFor(() => expect(callsTo("accounting_certificate_list")).toHaveLength(3));
    expect(callsTo("accounting_certificate_list").map(([, , args]) => args)).toEqual([{ milestoneID: "m1" }, { milestoneID: "m2" }, { milestoneID: "m3" }]);
  });

  it("shows a Payment certificates field", async () => {
    await openRoadLine();

    await waitFor(() => expect(pane().textContent).toContain("Payment certificates"));
  });

  it("draws one entry for each certificate with the milestone name, amount certified, payee name and retention withheld", async () => {
    await openRoadLine();

    await waitFor(() => expect(pane().textContent).toContain(roadCertificates.kerbs));
    expect(pane().textContent).toContain(roadCertificates.released);
    expect(pane().textContent).toContain(roadCertificates.waiting);
  });

  it("names the payee by the account's name and not by its id", async () => {
    await openRoadLine();

    await waitFor(() => expect(pane().textContent).toContain("Útépítő Kft."));
    expect(pane().textContent).not.toContain("ac3");
    expect(pane().textContent).not.toContain("ac4");
  });

  it("says released for a certificate whose retention was released, with no release day beside it", async () => {
    await openRoadLine();

    await waitFor(() => expect(pane().textContent).toContain(roadCertificates.released));
    expect(pane().textContent).not.toContain("can be released 2026-04-10");
    expect(pane().textContent).not.toContain("2026-04-12");
  });

  it("says can be released on its day for a certificate whose retention is still held", async () => {
    await openRoadLine();

    await waitFor(() => expect(pane().textContent).toContain("can be released 2026-05-20"));
    expect(pane().textContent).toContain("can be released 2026-06-18");
  });

  it("lists the certificates milestone by milestone, oldest first", async () => {
    await openRoadLine();

    await waitFor(() => expect(pane().textContent).toContain(roadCertificates.kerbs));
    const shown = pane().textContent ?? "";
    expect(shown.indexOf(roadCertificates.released)).toBeLessThan(shown.indexOf(roadCertificates.waiting));
    expect(shown.indexOf(roadCertificates.waiting)).toBeLessThan(shown.indexOf(roadCertificates.kerbs));
  });

  it("draws no Payment certificates field for a line whose milestones carry no certificate, though it still shows its Milestones", async () => {
    await openLine(/Sample Park Benches/);

    await waitFor(() => expect(pane().textContent).toContain("Benches delivered · 800 · due 2026-05-01 · planned · 0 certified"));
    await waitFor(() => expect(callsTo("accounting_certificate_list")).toHaveLength(1));
    expect(callsTo("accounting_certificate_list")[0][2]).toEqual({ milestoneID: "m4" });
    expect(pane().textContent).toContain("Milestones");
    expect(pane().textContent).not.toContain("Payment certificates");
  });

  it("reads no certificates for a line whose account has no milestones", async () => {
    await openLine(/Sample Library Books/);

    await waitFor(() => expect(callsTo("accounting_milestone_list")).toHaveLength(1));
    await waitFor(() => expect(pane().textContent).toContain("12,500"));
    expect(callsTo("accounting_certificate_list")).toHaveLength(0);
  });
});

describe("the agency's currency word beside milestone and certificate amounts", () => {
  const waitForWords = async () => {
    await waitFor(() => expect(callsTo("agency_list_mounts").length).toBeGreaterThan(0));
    await act(async () => undefined);
  };

  it("prints the unit after the value and certified amount of a milestone and the amount and retention of a certificate when the mount carries Currency = Ft", async () => {
    words = { Currency: "Ft" };
    await openRoadLine();
    await waitForWords();

    await waitFor(() => expect(pane().textContent).toContain("Base course laid · 600 Ft · due 2026-03-15 · part certified · 400 Ft certified"));
    expect(pane().textContent).toContain("Base course laid · 300 Ft certified · Útépítő Kft. · 30 Ft withheld · released");
    expect(pane().textContent).toContain("Base course laid · 100 Ft certified · Útépítő Kft. · 10 Ft withheld · can be released 2026-05-20");
  });

  it("prints bare numbers when the mount carries no word for Currency", async () => {
    await openRoadLine();
    await waitForWords();

    await waitFor(() => expect(pane().textContent).toContain(roadMilestones.base));
    expect(pane().textContent).not.toMatch(/\bFt\b|Currency/);
  });
});

describe("reading milestones changes nothing", () => {
  it("calls no tool that writes while a line with milestones and certificates is open", async () => {
    await openRoadLine();
    await waitFor(() => expect(pane().textContent).toContain(roadCertificates.kerbs));

    const names = called.mock.calls.map(([, tool]) => String(tool));
    expect(names.filter((tool) => /_(set|create|update|release|release_retention|mark_paid|send)$/.test(tool))).toEqual([]);
    expect(names).toEqual(expect.arrayContaining(["accounting_milestone_list", "accounting_certificate_list"]));
  });
});

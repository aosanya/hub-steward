import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { PaymentListScreen } from "./PaymentListScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const annaBill = { id: "b1", payer: "Anna Sample", amount: 1500, settled: 300, outstanding: 1200, due_at: "2026-12-01T00:00:00Z", status: "open" };
const lateBill = { id: "b2", payer: "Csilla Sample", amount: 800, settled: 0, outstanding: 800, due_at: "2026-10-01T00:00:00Z", status: "overdue", days_overdue: 40 };

const people = [
  { id: "a1", display_name: "Kiss Ágnes" },
  { id: "a2", display_name: "Varga Mária" },
  { id: "a3", display_name: "" },
];

const origin = { path: "/a/town/menu/finance", title: "Finance" };

const chaserKey = "unpaid_list_chaser";

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let savedChaser: string;
let recipients: string[];

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const openScreen = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/finance/payments", state: { from: origin } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/payments" element={<PaymentListScreen />} />
      </Routes>
    </MemoryRouter>,
  );

const openSheet = async () => {
  await userEvent.click(await screen.findByRole("button", { name: "Send the list" }));
  return screen.findByRole("dialog", { name: "Hand over the list" });
};

beforeEach(() => {
  openAgency("town");
  permissions = ["accounting.read", "accounting.manage", "notification.raise"];
  savedChaser = "";
  recipients = ["a1", "a2", "a3"];
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const given = (args ?? {}) as Record<string, unknown>;
    if (name === "agency_get_my_roles") return { permissions };
    if (name === "accounting_bill_list") return { items: given.status === "open" ? [annaBill] : given.status === "overdue" ? [lateBill] : [] };
    if (name === "accounting_payment_list") return { items: [] };
    if (name === "accounting_account_list") return { items: [] };
    if (name === "actor_list_actors") return { items: people };
    if (name === "comm_notification_recipients") return { items: recipients.map((actor_id) => ({ actor_id })) };
    if (name === "forms_catalog_setting_read") return given.key === chaserKey && savedChaser ? { value: savedChaser } : null;
    if (name === "forms_catalog_setting_write") {
      savedChaser = String(given.value);
      return {};
    }
    if (name === "comm_notification_raise") return {};
    throw new Error(`${name} is not a tool this screen may use`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("handing the list of who has not paid to a person", () => {
  it("offers Send the list beside the Owed line to a caller who may raise a notification", async () => {
    openScreen();

    expect(await screen.findByRole("button", { name: "Send the list" })).toBeInTheDocument();
  });

  it("offers no Send the list to a caller who may not raise a notification", async () => {
    permissions = ["accounting.read", "accounting.manage"];
    openScreen();

    await screen.findByText(/Owed in total/);
    await waitFor(() => expect(callsTo("agency_get_my_roles").length).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: "Send the list" })).toBeNull();
  });

  it("raises one payment_list_handed_over notification for the chosen person with the total, the payers and each owed row", async () => {
    openScreen();
    await openSheet();
    await userEvent.click(await screen.findByRole("button", { name: /Person/ }));
    await userEvent.click(screen.getByRole("option", { name: "Varga Mária" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(callsTo("comm_notification_raise")).toHaveLength(1));
    const sent = callsTo("comm_notification_raise")[0][2] as Record<string, unknown>;
    expect(sent).toMatchObject({ recipient_id: "a2", category: "task", event: "payment_list_handed_over", subject_kind: "report" });
    const names = sent.names as Record<string, string>;
    expect(names.total).toBe("2,000");
    expect(names.payers).toBe("2");
    expect(names.list.split("\n")).toHaveLength(2);
    expect(names.list).toContain("Anna Sample");
    expect(names.list).toContain("Csilla Sample");
    expect(await screen.findByText("Sent to Varga Mária")).toBeInTheDocument();
  });

  it("remembers the person as the one who chases and opens the next sheet with that person chosen", async () => {
    openScreen();
    await openSheet();
    await userEvent.click(await screen.findByRole("button", { name: /Person/ }));
    await userEvent.click(screen.getByRole("option", { name: "Varga Mária" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(callsTo("forms_catalog_setting_write")).toHaveLength(1));
    expect(callsTo("forms_catalog_setting_write")[0][2]).toEqual({ key: chaserKey, value: "a2" });
    await userEvent.click((await screen.findAllByRole("button", { name: "Close" }))[0]);

    await openSheet();

    await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeEnabled());
    expect(screen.getByRole("button", { name: /Person/ })).toHaveTextContent("Varga Mária");
  });

  it("shows a person with no name as Unnamed person among the choices", async () => {
    openScreen();
    await openSheet();
    await userEvent.click(await screen.findByRole("button", { name: /Person/ }));

    expect(screen.getByRole("option", { name: "Unnamed person" })).toBeInTheDocument();
  });

  it("asks the hub who may be sent the list and offers only those people", async () => {
    recipients = ["a2"];
    openScreen();
    await openSheet();
    await userEvent.click(await screen.findByRole("button", { name: /Person/ }));

    expect(callsTo("comm_notification_recipients")[0][2]).toEqual({ event: "payment_list_handed_over" });
    expect(screen.getByRole("option", { name: "Varga Mária" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Kiss Ágnes" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Unnamed person" })).toBeNull();
  });

  it("says so in words when nobody holds a seat that receives the list, and offers no Send", async () => {
    recipients = [];
    openScreen();
    await openSheet();

    expect(await screen.findByText("No one holds a seat that receives this list yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
  });
});

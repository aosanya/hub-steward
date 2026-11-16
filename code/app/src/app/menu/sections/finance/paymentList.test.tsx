import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { PaymentListScreen } from "./PaymentListScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const payments = [
  { id: "p1", payer: "Anna Sample", amount: 1200, paid: false },
  { id: "p2", payer: "Ben Sample", amount: 450, paid: true },
];

const origin = { path: "/a/town/menu/finance", title: "Finance" };

let called: MockInstance<typeof mcp.callTool>;
let failMarking = false;

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const rowOf = async (payer: string) => (await screen.findByRole("button", { name: new RegExp(payer) })) as HTMLElement;

const openScreen = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/finance/payments", state: { from: origin } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/payments" element={<PaymentListScreen />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  openAgency("town");
  failMarking = false;
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
    if (name === "accounting_payment_list") return { items: payments };
    if (name === "accounting_payment_mark_paid" && failMarking) throw new Error("refused");
    if (name === "accounting_payment_mark_paid") return { id: "p1", paid: true };
    throw new Error(`${name} is not a tool this screen may use`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("PaymentListScreen", () => {
  it("lists each payer with the amount and whether it is paid", async () => {
    openScreen();

    const anna = await rowOf("Anna Sample");
    expect(within(anna).getByText("1,200")).toBeInTheDocument();
    expect(within(anna).getByText("Unpaid")).toBeInTheDocument();
    const ben = await rowOf("Ben Sample");
    expect(within(ben).getByText("Paid")).toBeInTheDocument();
  });

  it("offers Mark paid on an unpaid payment", async () => {
    openScreen();
    await userEvent.click(await rowOf("Anna Sample"));

    expect(await screen.findByRole("button", { name: "Mark paid" })).toBeInTheDocument();
  });

  it("does not offer Mark paid on a payment already paid", async () => {
    openScreen();
    await userEvent.click(await rowOf("Ben Sample"));

    await waitFor(() => expect(pane().textContent).toContain("Ben Sample"));
    expect(screen.queryByRole("button", { name: "Mark paid" })).toBeNull();
  });

  it("calls accounting_payment_mark_paid with the id and then reads Paid", async () => {
    openScreen();
    await userEvent.click(await rowOf("Anna Sample"));
    await userEvent.click(await screen.findByRole("button", { name: "Mark paid" }));

    await waitFor(() => expect(callsTo("accounting_payment_mark_paid")).toHaveLength(1));
    expect(callsTo("accounting_payment_mark_paid")[0]).toEqual(["", "accounting_payment_mark_paid", { id: "p1" }]);
    await waitFor(() => expect(within(screen.getAllByRole("button", { name: /Anna Sample/ })[0]).getByText("Paid")).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole("button", { name: "Mark paid" })).toBeNull());
  });

  it("keeps the row Unpaid and says so when marking is refused", async () => {
    failMarking = true;
    openScreen();
    await userEvent.click(await rowOf("Anna Sample"));
    await userEvent.click(await screen.findByRole("button", { name: "Mark paid" }));

    expect(await screen.findByText(/did not go through/i)).toBeInTheDocument();
    expect(within(await rowOf("Anna Sample")).getByText("Unpaid")).toBeInTheDocument();
  });

  it("says so when there are no payments", async () => {
    called.mockImplementation(async () => ({ items: [] }));
    openScreen();

    expect(await screen.findByText("No payments yet.")).toBeInTheDocument();
  });
});

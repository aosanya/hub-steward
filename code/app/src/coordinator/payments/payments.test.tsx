import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { GroupOrder, GroupOrderClient } from "../../supply/groupOrder/api";
import * as mcp from "../../wakala/mcp";
import { holdsGroupCoordinator, isDuplicate, mcpPaymentsClient, paymentOf, recordOf, type Payment, type PaymentsClient, type PaymentsRecord } from "./api";
import { InboxPage } from "../../pages/InboxPage";
import type { InboxClient } from "../../inbox/api";
import { CoordinatorOrderCards } from "./OrderCards";
import { AddPaymentPage, CoordinatorOrderPage, ManagePaymentsPage } from "./PaymentsPages";

const record: PaymentsRecord = { code: "R-1", name: "Payments", canAdd: true, farmerPrompt: "Farmer", amountPrompt: "Amount paid" };

const order: GroupOrder = {
  id: "g1",
  posterId: "p1",
  product: "urea",
  productWords: "Urea 50kg",
  coordinator: "Grace Test",
  price: 3600,
  minimum: 20,
  termsVersion: 1,
  startedWith: null,
  state: "open",
  total: 8,
  count: 4,
  lines: [],
};

const ordersOf = (o: GroupOrder): GroupOrderClient => ({
  listGroupOrders: vi.fn(),
  getGroupOrder: vi.fn().mockResolvedValue(o),
  askRevision: vi.fn(),
});

const payment = (i: number): Payment => ({ id: `r${i}`, farmer: `Farmer ${i}`, farmerId: `m${i}`, amount: `KES ${i}00`, paid: `${i}00`, correctedOn: "" });

const paymentsOf = (rows: Payment[]): PaymentsClient => ({
  record: vi.fn().mockResolvedValue(record),
  payments: vi.fn().mockResolvedValue(rows),
  people: vi.fn().mockResolvedValue([{ id: "m1", name: "Asha Test" }]),
  add: vi.fn().mockResolvedValue("saved"),
  owns: vi.fn().mockResolvedValue(true),
  runs: vi.fn().mockResolvedValue(true),
  send: vi.fn().mockResolvedValue(undefined),
});

const chooseFarmer = async (typed: string, name: string) => {
  await userEvent.click(await screen.findByLabelText("Farmer"));
  await userEvent.type(screen.getByRole("combobox"), typed);
  await userEvent.click(screen.getByRole("option", { name }));
};

const at = (path: string, ui: React.ReactNode, route = "/coordinator/orders/:orderId") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={ui} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("coordinator group order", () => {
  it("shows terms, bags and Manage payments, and sends the order", async () => {
    const orders = ordersOf(order);
    const payments = paymentsOf([]);
    at("/coordinator/orders/g1", <CoordinatorOrderPage orders={orders} payments={payments} />);
    expect(await screen.findByText("Manage payments")).toBeInTheDocument();
    expect(screen.getByText("Urea 50kg")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Send the order" }));
    expect(payments.send).toHaveBeenCalledWith("g1");
  });

  it("marks a sent order Sent as a chip on the first row and offers no button", async () => {
    at("/coordinator/orders/g1", <CoordinatorOrderPage orders={ordersOf({ ...order, state: "sent" })} payments={paymentsOf([])} />);
    const sent = await screen.findByText("Sent");
    expect(sent).toHaveClass("chip");
    expect(sent.closest(".row")).toBe(screen.getByText("KES 3,600 a bag from 20 bags").closest(".row"));
    expect(screen.queryByRole("button", { name: "Send the order" })).toBeNull();
  });

  it("marks a called-off order Called off on the first row and offers no button", async () => {
    at("/coordinator/orders/g1", <CoordinatorOrderPage orders={ordersOf({ ...order, state: "cancelled" })} payments={paymentsOf([])} />);
    const calledOff = await screen.findByText("Called off");
    expect(calledOff).toHaveClass("chip");
    expect(calledOff.closest(".row")).toBe(screen.getByText("KES 3,600 a bag from 20 bags").closest(".row"));
    expect(screen.queryByText("Sent")).toBeNull();
    expect(screen.queryByRole("button", { name: "Send the order" })).toBeNull();
  });

  it("marks an open order with neither chip", async () => {
    at("/coordinator/orders/g1", <CoordinatorOrderPage orders={ordersOf(order)} payments={paymentsOf([])} />);
    await screen.findByText("Manage payments");
    expect(screen.queryByText("Sent")).toBeNull();
    expect(screen.queryByText("Called off")).toBeNull();
  });

  it("says how many farmers have joined on the bags row, from the order's count", async () => {
    at("/coordinator/orders/g1", <CoordinatorOrderPage orders={ordersOf(order)} payments={paymentsOf([])} />);
    const bagsRow = (await screen.findByText("8 bags of 20")).closest(".row") as HTMLElement;
    expect(within(bagsRow).getByText("4 farmers")).toBeInTheDocument();
    expect(within(bagsRow).getByText("Grace Test")).toBeInTheDocument();
  });

  it("says one farmer for a single farmer", async () => {
    at("/coordinator/orders/g1", <CoordinatorOrderPage orders={ordersOf({ ...order, count: 1, total: 5 })} payments={paymentsOf([])} />);
    expect(await screen.findByText("1 farmer")).toBeInTheDocument();
  });

  it("says how many payments are added on the Manage payments row, from the rows read", async () => {
    const payments = paymentsOf([1, 2, 3].map(payment));
    at("/coordinator/orders/g1", <CoordinatorOrderPage orders={ordersOf(order)} payments={payments} />);
    const row = (await screen.findByText("Manage payments")).closest(".row") as HTMLElement;
    expect(await within(row).findByText("3 added")).toBeInTheDocument();
    expect(payments.payments).toHaveBeenCalledWith(record, "g1");
  });

  it("is titled with its product under the bar, over the form's name", async () => {
    at("/coordinator/orders/g1", <CoordinatorOrderPage orders={ordersOf(order)} payments={paymentsOf([])} />);
    const title = await screen.findByRole("heading", { level: 1, name: "Urea 50kg" });
    expect(title.nextElementSibling).toHaveTextContent("Create group order");
    expect(screen.getAllByText("Urea 50kg")).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Group order" })).toBeNull();
  });

  it("keeps the title Group order, with no form name, when the order cannot be opened", async () => {
    const failing = { ...ordersOf(order), getGroupOrder: vi.fn().mockRejectedValue(new Error("down")) };
    at("/coordinator/orders/g1", <CoordinatorOrderPage orders={failing} payments={paymentsOf([])} />);
    expect(await screen.findByText("This group order could not be opened.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Group order" }).nextElementSibling).toBeNull();
  });

  it("puts Manage payments under a Records heading, not among the details", async () => {
    at("/coordinator/orders/g1", <CoordinatorOrderPage orders={ordersOf(order)} payments={paymentsOf([])} />);
    const records = await screen.findByRole("heading", { level: 2, name: "Records" });
    const manage = screen.getByText("Manage payments").closest(".row") as HTMLElement;
    const details = screen.getByText("KES 3,600 a bag from 20 bags").closest(".rows") as HTMLElement;
    expect(details).not.toContainElement(manage);
    expect(records.compareDocumentPosition(manage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(details.compareDocumentPosition(records) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("says 0 added when the order has no payments yet", async () => {
    at("/coordinator/orders/g1", <CoordinatorOrderPage orders={ordersOf(order)} payments={paymentsOf([])} />);
    expect(await screen.findByText("0 added")).toBeInTheDocument();
  });

  it("still opens, with no count, when the payments cannot be read", async () => {
    const payments = { ...paymentsOf([]), payments: vi.fn().mockRejectedValue(new Error("down")) };
    at("/coordinator/orders/g1", <CoordinatorOrderPage orders={ordersOf(order)} payments={payments} />);
    expect(await screen.findByText("Manage payments")).toBeInTheDocument();
    expect(screen.queryByText(/ added$/)).toBeNull();
    expect(screen.getByRole("button", { name: "Send the order" })).toBeInTheDocument();
  });

  it("lists payments first rows then Show more", async () => {
    const rows = [1, 2, 3, 4, 5].map(payment);
    at("/coordinator/orders/g1/payments", <ManagePaymentsPage orders={ordersOf(order)} payments={paymentsOf(rows)} />, "/coordinator/orders/:orderId/payments");
    expect(await screen.findByText("Farmer 1")).toBeInTheDocument();
    expect(screen.queryByText("Farmer 5")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /show more/i }));
    expect(await screen.findByText("Farmer 5")).toBeInTheDocument();
  });

  it("with none, is one card with its line and Add a payment inside", async () => {
    at("/coordinator/orders/g1/payments", <ManagePaymentsPage orders={ordersOf(order)} payments={paymentsOf([])} />, "/coordinator/orders/:orderId/payments");
    const empty = (await screen.findByText("No payments yet")).closest(".card") as HTMLElement;
    expect(within(empty).getByText("Add a farmer's payment when it reaches you.")).toBeInTheDocument();
    expect(within(empty).getByRole("button", { name: "Add a payment" })).toBeInTheDocument();
  });

  it("with none and no right to add, carries neither the line nor the button", async () => {
    const payments = { ...paymentsOf([]), record: vi.fn().mockResolvedValue({ ...record, canAdd: false }) };
    at("/coordinator/orders/g1/payments", <ManagePaymentsPage orders={ordersOf(order)} payments={payments} />, "/coordinator/orders/:orderId/payments");
    expect(await screen.findByText("No payments yet")).toBeInTheDocument();
    expect(screen.queryByText("Add a farmer's payment when it reaches you.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a payment" })).toBeNull();
  });

  it("draws the closed Farmer dropdown with the same field and input classes as the Amount field", async () => {
    at("/coordinator/orders/g1/payments/new", <AddPaymentPage payments={paymentsOf([])} />, "/coordinator/orders/:orderId/payments/new");
    const farmer = await screen.findByLabelText("Farmer");
    const amount = screen.getByLabelText("Amount paid");
    expect(farmer.closest(".search-select")).not.toBeNull();
    expect(farmer.closest(".field")).not.toBeNull();
    expect(amount.closest(".field")).not.toBeNull();
    expect(farmer).toHaveClass("input");
    expect(amount.parentElement).toHaveClass("input");
    expect(farmer.className).toBe(amount.parentElement?.className);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("saves a payment from the form", async () => {
    const payments = paymentsOf([]);
    at("/coordinator/orders/g1/payments/new", <AddPaymentPage payments={payments} />, "/coordinator/orders/:orderId/payments/new");
    await chooseFarmer("as", "Asha Test");
    await userEvent.type(screen.getByLabelText("Amount paid"), "7200");
    await userEvent.click(screen.getByRole("button", { name: "Save payment" }));
    expect(payments.add).toHaveBeenCalledWith({ record, orderId: "g1", farmerId: "m1", amount: "7200", replaces: undefined });
  });

  it("narrows the Farmer names as she types, and shows the chosen name in the closed box", async () => {
    const payments = { ...paymentsOf([]), people: vi.fn().mockResolvedValue([{ id: "m1", name: "Asha Test" }, { id: "m2", name: "Baraka Test" }]) };
    at("/coordinator/orders/g1/payments/new", <AddPaymentPage payments={payments} />, "/coordinator/orders/:orderId/payments/new");
    await userEvent.click(await screen.findByLabelText("Farmer"));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Asha Test", "Baraka Test"]);
    await userEvent.type(screen.getByRole("combobox"), "as");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Asha Test"]);
    await userEvent.click(screen.getByRole("option", { name: "Asha Test" }));
    expect(screen.getByLabelText("Farmer").querySelector(".val")?.textContent).toBe("Asha Test");
  });

  it("asks her to choose the farmer when she saves with none chosen", async () => {
    const payments = paymentsOf([]);
    at("/coordinator/orders/g1/payments/new", <AddPaymentPage payments={payments} />, "/coordinator/orders/:orderId/payments/new");
    await userEvent.type(await screen.findByLabelText("Amount paid"), "7200");
    await userEvent.click(screen.getByRole("button", { name: "Save payment" }));
    expect(await screen.findByText("Choose Farmer.")).toBeInTheDocument();
    expect(payments.add).not.toHaveBeenCalled();
  });

  it("reads the record and rows from the live-records shape", () => {
    const found = recordOf({
      code: "R-1",
      name: "Payments",
      can_add_rows: true,
      questions: [
        { prompt: "Farmer", answer_type: "single_choice", options_from: "members" },
        { prompt: "Amount paid", answer_type: "text" },
      ],
    });
    expect(found).toEqual(record);
    const row = paymentOf(record, new Map([["m1", "Asha Test"]]))({ id: "r1", answers: { Farmer: "m1", "Amount paid": "7200" } });
    expect(row).toEqual({ id: "r1", farmer: "Asha Test", farmerId: "m1", amount: "KES 7,200", paid: "7200", correctedOn: "" });
  });

  it("names a farmer with no display name by the record's own farmer question, never by the id", () => {
    const record = { code: "R-1", name: "Payments", canAdd: true, farmerPrompt: "Farmer", amountPrompt: "Amount paid" };
    const row = paymentOf(record, new Map())({ id: "r2", answers: { Farmer: "b7e1c2d4-0000-4000-8000-000000000001", "Amount paid": "3600" } });
    expect(row.farmer).toBe("Farmer");
    expect(row.farmerId).toBe("b7e1c2d4-0000-4000-8000-000000000001");
  });
});

describe("payments screens under the bar", () => {
  it("titles Manage payments under the bar with the back link and the menu button in it, no sub line, and the product as its section heading", async () => {
    at("/coordinator/orders/g1/payments", <ManagePaymentsPage orders={ordersOf(order)} payments={paymentsOf([payment(1)])} />, "/coordinator/orders/:orderId/payments");
    const title = await screen.findByRole("heading", { level: 1, name: "Manage payments" });
    expect(screen.getByRole("banner")).not.toContainElement(title);
    expect(within(screen.getByRole("banner")).getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(within(screen.getByRole("banner")).getByRole("button", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("main").querySelector(".sub")).toBeNull();
    const product = await screen.findByRole("heading", { level: 2, name: "Urea 50kg" });
    expect(product).toHaveClass("heading");
    expect(title.parentElement?.nextElementSibling).toBe(product);
  });

  it("draws the empty Manage payments card straight under its title, with no product heading", async () => {
    at("/coordinator/orders/g1/payments", <ManagePaymentsPage orders={ordersOf(order)} payments={paymentsOf([])} />, "/coordinator/orders/:orderId/payments");
    const title = await screen.findByRole("heading", { level: 1, name: "Manage payments" });
    expect(title.parentElement?.nextElementSibling).toBe((await screen.findByText("No payments yet")).closest(".card"));
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });

  it.each([
    ["/coordinator/orders/g1/payments/new", "/coordinator/orders/:orderId/payments/new", "Add a payment"],
    ["/coordinator/orders/g1/payments/r1/correct", "/coordinator/orders/:orderId/payments/:rowId/correct", "Correct a payment"],
  ])("titles %s as %s under the bar, with the form as the very next thing and no sub line", async (path, route, name) => {
    at(path, <AddPaymentPage payments={paymentsOf([payment(1)])} />, route);
    const title = await screen.findByRole("heading", { level: 1, name });
    expect(screen.getByRole("banner")).not.toContainElement(title);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(title.parentElement?.querySelector(".sub")).toBeNull();
    expect(title.parentElement?.nextElementSibling).toBe((await screen.findByLabelText("Amount paid")).closest(".card"));
  });
});

describe("payments screens that cannot load", () => {
  const managePayments = (payments: PaymentsClient) =>
    at("/coordinator/orders/g1/payments", <ManagePaymentsPage orders={ordersOf(order)} payments={payments} />, "/coordinator/orders/:orderId/payments");

  it("announces The payments could not be loaded. in the failure card when the record cannot be read", async () => {
    managePayments({ ...paymentsOf([]), record: vi.fn().mockRejectedValue(new Error("down")) });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The payments could not be loaded.");
    expect(alert.closest(".card")).toHaveClass("empty");
    expect(screen.queryByText("No payments yet")).toBeNull();
  });

  it("announces Payments could not be opened. when the form has no record to save into", async () => {
    at("/coordinator/orders/g1/payments/new", <AddPaymentPage payments={{ ...paymentsOf([]), record: vi.fn().mockResolvedValue(null) }} />, "/coordinator/orders/:orderId/payments/new");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Payments could not be opened.");
    expect(alert.closest(".card")).toHaveClass("empty");
    expect(screen.queryByRole("button", { name: "Save payment" })).toBeNull();
  });

  it("announces Payments could not be opened. when the payment to correct is not among the rows", async () => {
    at("/coordinator/orders/g1/payments/r9/correct", <AddPaymentPage payments={paymentsOf([payment(1)])} />, "/coordinator/orders/:orderId/payments/:rowId/correct");
    expect(await screen.findByRole("alert")).toHaveTextContent("Payments could not be opened.");
    expect(screen.queryByRole("button", { name: "Save payment" })).toBeNull();
  });

  it("announces nothing when the payment to correct is found", async () => {
    at("/coordinator/orders/g1/payments/r1/correct", <AddPaymentPage payments={paymentsOf([payment(1)])} />, "/coordinator/orders/:orderId/payments/:rowId/correct");
    await screen.findByRole("button", { name: "Save payment" });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the menu on a screen with a back link", () => {
  const paymentsList = () =>
    render(
      <MemoryRouter initialEntries={["/coordinator/orders/g1/payments"]}>
        <Routes>
          <Route path="/coordinator/orders/:orderId/payments" element={<ManagePaymentsPage orders={ordersOf(order)} payments={paymentsOf([payment(1)])} />} />
          <Route path="/agencies" element={<h1>Your agencies page</h1>} />
        </Routes>
      </MemoryRouter>,
    );

  it("opens the account drawer from the payments list and slides the page", async () => {
    paymentsList();
    await screen.findByText("Farmer 1");
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("My profile"),
      expect.stringContaining("Switch agency"),
      expect.stringContaining("Change language"),
      expect.stringContaining("Sign out"),
    ]);
    expect((screen.getByRole("main").closest(".page") as HTMLElement).classList.contains("open")).toBe(true);
  });

  it("goes to Your agencies from Switch agency in the drawer", async () => {
    paymentsList();
    await screen.findByText("Farmer 1");
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Switch agency/ }));
    expect(await screen.findByRole("heading", { name: "Your agencies page" })).toBeInTheDocument();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("coordinator group order gates", () => {
  const rendered = (state: string, runs: boolean) => {
    const payments = { ...paymentsOf([]), runs: vi.fn().mockResolvedValue(runs) };
    at("/coordinator/orders/g1", <CoordinatorOrderPage orders={ordersOf({ ...order, state })} payments={payments} />);
    return screen.findByText("Manage payments");
  };

  it("hides Send the order from someone who neither owns the agency nor holds the Group coordinator role", async () => {
    await rendered("open", false);
    expect(screen.queryByRole("button", { name: "Send the order" })).toBeNull();
  });

  it("shows Send the order to a person who runs orders, while the order is open", async () => {
    await rendered("open", true);
    expect(screen.getByRole("button", { name: "Send the order" })).toBeInTheDocument();
  });

  it.each(["revising", "closed", "cancelled"])("hides Send the order for a %s order", async (state) => {
    await rendered(state, true);
    expect(screen.queryByRole("button", { name: "Send the order" })).toBeNull();
    expect(screen.queryByText("Sent")).toBeNull();
  });

  it("shows no Add a payment when the record does not allow adding", async () => {
    const payments = { ...paymentsOf([payment(1)]), record: vi.fn().mockResolvedValue({ ...record, canAdd: false }) };
    at("/coordinator/orders/g1/payments", <ManagePaymentsPage orders={ordersOf(order)} payments={payments} />, "/coordinator/orders/:orderId/payments");
    expect(await screen.findByText("Farmer 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a payment" })).toBeNull();
  });
});

describe("correcting a payment", () => {
  it("notes the correction date on a corrected row", async () => {
    const rows = [{ ...payment(1), correctedOn: "2026-11-02" }];
    at("/coordinator/orders/g1/payments", <ManagePaymentsPage orders={ordersOf(order)} payments={paymentsOf(rows)} />, "/coordinator/orders/:orderId/payments");
    expect(await screen.findByText("Corrected on 2026-11-02")).toBeInTheDocument();
  });

  it("opens a row, and saves the new amount as a replacement", async () => {
    const payments = paymentsOf([payment(1)]);
    at("/coordinator/orders/g1/payments/r1/correct", <AddPaymentPage payments={payments} />, "/coordinator/orders/:orderId/payments/:rowId/correct");
    const amount = await screen.findByLabelText("Amount paid");
    expect(amount).toHaveValue("100");
    expect(screen.getByLabelText("Farmer").querySelector(".val")?.textContent).toBe("Asha Test");
    await userEvent.clear(amount);
    await userEvent.type(amount, "150");
    await userEvent.click(screen.getByRole("button", { name: "Save payment" }));
    expect(payments.add).toHaveBeenCalledWith({ record, orderId: "g1", farmerId: "m1", amount: "150", replaces: "r1" });
  });

  it("tells her a repeat save was refused", async () => {
    const payments = { ...paymentsOf([]), add: vi.fn().mockResolvedValue("duplicate") };
    at("/coordinator/orders/g1/payments/new", <AddPaymentPage payments={payments} />, "/coordinator/orders/:orderId/payments/new");
    await chooseFarmer("as", "Asha Test");
    await userEvent.type(screen.getByLabelText("Amount paid"), "7200");
    await userEvent.click(screen.getByRole("button", { name: "Save payment" }));
    expect(await screen.findByText("This payment was just saved. Wait a minute to save it again.")).toBeInTheDocument();
  });
});

describe("payments over the tools", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reads rows for the order with names and KES, and adds with order_id and replaces", async () => {
    const call = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
      if (tool === "agency_list_live_record_rows") return { items: [{ id: "r1", answers: { Farmer: "m1", "Amount paid": "7200" }, corrected_on: "2026-11-02T08:00:00Z" }] };
      if (tool === "actor_list_actors") return { items: [{ id: "m1", display_name: "Asha Test" }] };
      return {};
    });
    const rows = await mcpPaymentsClient.payments(record, "g1");
    expect(rows).toEqual([{ id: "r1", farmer: "Asha Test", farmerId: "m1", amount: "KES 7,200", paid: "7200", correctedOn: "2026-11-02" }]);
    expect(call).toHaveBeenCalledWith("", "agency_list_live_record_rows", { record_code: "R-1", order_id: "g1" });
    await mcpPaymentsClient.add({ record, orderId: "g1", farmerId: "m1", amount: "150", replaces: "r1" });
    expect(call).toHaveBeenCalledWith("", "agency_add_live_record_row", {
      record_code: "R-1",
      order_id: "g1",
      answers: { Farmer: "m1", "Amount paid": "150" },
      replaces: "r1",
    });
  });

  it("answers duplicate when the backend refuses a repeat", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new mcp.McpError("agency_add_live_record_row: mwanachamaagency: the same answers were saved a moment ago"));
    expect(await mcpPaymentsClient.add({ record, orderId: "g1", farmerId: "m1", amount: "150" })).toBe("duplicate");
    expect(isDuplicate(new Error("boom"))).toBe(false);
  });

  it("is the owner only when the membership says owner", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ membership: "owner" });
    expect(await mcpPaymentsClient.owns()).toBe(true);
    call.mockResolvedValue({ membership: "agent" });
    expect(await mcpPaymentsClient.owns()).toBe(false);
  });

  it("runs orders as the owner, and as an agent who holds the Group coordinator role", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ membership: "owner", roles: [] });
    expect(await mcpPaymentsClient.runs()).toBe(true);
    expect(call).toHaveBeenCalledWith("", "agency_get_my_roles");
    call.mockResolvedValue({ membership: "agent", roles: [{ id: "r1", code: "R-1", name: "Group coordinator" }] });
    expect(await mcpPaymentsClient.runs()).toBe(true);
    call.mockResolvedValue({ membership: "agent", roles: [{ id: "r2", code: "R-2", name: "Supplier liaison" }] });
    expect(await mcpPaymentsClient.runs()).toBe(false);
    call.mockResolvedValue({ membership: "resident", roles: [] });
    expect(await mcpPaymentsClient.runs()).toBe(false);
  });

  it("finds the Group coordinator role by name, whatever its case or spacing", () => {
    expect(holdsGroupCoordinator({ roles: [{ name: "  group COORDINATOR " }] })).toBe(true);
    expect(holdsGroupCoordinator({ roles: [{ name: "Coordinator" }] })).toBe(false);
    expect(holdsGroupCoordinator({})).toBe(false);
  });
});

describe("Do Something cards for the owner", () => {
  it("links each live order to its page, and shows nothing to a non-owner", async () => {
    const orders = { ...ordersOf(order), listGroupOrders: vi.fn().mockResolvedValue([order, { ...order, id: "g2", state: "cancelled" }]) };
    at("/", <CoordinatorOrderCards orders={orders} payments={paymentsOf([])} />, "/");
    await userEvent.click(await screen.findByText("Urea 50kg"));
    expect(await screen.findByText("elsewhere")).toBeInTheDocument();
    expect(screen.queryByText("Urea 50kg")).toBeNull();
  });

  it("renders nothing when she is not the owner", async () => {
    const payments = { ...paymentsOf([]), owns: vi.fn().mockResolvedValue(false) };
    const orders = ordersOf(order);
    at("/", <CoordinatorOrderCards orders={orders} payments={payments} />, "/");
    await vi.waitFor(() => expect(payments.owns).toHaveBeenCalled());
    expect(screen.queryByText("Urea 50kg")).toBeNull();
  });
});

describe("called-off Inbox row", () => {
  it("opens the group order the event names", async () => {
    const client: InboxClient = {
      listNotifications: vi.fn().mockResolvedValue([
        { id: "n1", event: "group_order_called_off", subjectKind: "group_order", subjectId: "g1", names: { product: "Urea 50kg" }, createdAt: "2026-11-01T16:40:00Z", read: false },
      ]),
      markRead: vi.fn().mockResolvedValue(1),
      listInvitations: vi.fn().mockResolvedValue([]),
      acceptInvitation: vi.fn(),
      declineInvitation: vi.fn(),
    };
    at("/inbox", <InboxPage client={client} />, "/inbox");
    await userEvent.click(await screen.findByText("The Urea 50kg group order was called off"));
    expect(await screen.findByText("elsewhere")).toBeInTheDocument();
  });
});

describe("the coordinator on her order page", () => {
  const coordinatorId = "9f1c7d2e-4b8a-4c63-8e0f-5a2d6b7c1e34";

  const marketWithActors = (displayName: string) =>
    vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
      if (tool === "actor_list_actors") return { items: [{ id: coordinatorId, display_name: displayName }] };
      return { id: "g1", poster_id: "p1", product: "Urea 50kg", coordinator: coordinatorId, price: 3600, minimum: 20, state: "open", total: 8, count: 4, lines: [] };
    });

  afterEach(() => vi.restoreAllMocks());

  it("names her from her actor", async () => {
    marketWithActors("Grace Adhiambo");
    at("/coordinator/orders/g1", <CoordinatorOrderPage payments={paymentsOf([])} />);
    const bagsRow = (await screen.findByText("8 bags of 20")).closest(".row") as HTMLElement;
    expect(within(bagsRow).getByText("Grace Adhiambo")).toBeInTheDocument();
  });

  it("says Group coordinator, never her id, when her actor has an empty display name", async () => {
    marketWithActors("");
    const { container } = at("/coordinator/orders/g1", <CoordinatorOrderPage payments={paymentsOf([])} />);
    const bagsRow = (await screen.findByText("8 bags of 20")).closest(".row") as HTMLElement;
    expect(within(bagsRow).getByText("Group coordinator")).toBeInTheDocument();
    expect(container.textContent).not.toContain(coordinatorId);
  });
});

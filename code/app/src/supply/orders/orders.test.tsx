import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as mcp from "../../wakala/mcp";
import { mcpOrdersClient, orderOf, orderTotal, yesOf, type OrdersClient, type SupplyOrder, type SupplyYes } from "./api";
import { OrderPage } from "./OrderPage";
import { OrdersPage } from "./OrdersPage";

const asha: SupplyOrder = {
  id: "or1",
  picker: "Asha Otieno",
  yesId: "",
  promisedDate: "",
  supplierId: "p1",
  product: "Urea 50kg",
  quantity: 2,
  unitPrice: 3800,
  state: "open",
  paid: false,
  createdAt: "2026-11-06T08:00:00Z",
};
const auma: SupplyOrder = { ...asha, id: "or2", picker: "Auma Oluoch", paid: true };
const yes: SupplyYes = {
  id: "y1",
  askId: "a1",
  supplierId: "p1",
  picker: "Baraka Njeri",
  what: "DAP 50kg",
  quantity: 3,
  date: "2026-11-09",
  note: "",
  state: "open",
};

const clientOf = (orders: SupplyOrder[], yeses: SupplyYes[] = []): OrdersClient => ({
  listYeses: vi.fn().mockResolvedValue(yeses),
  listOrders: vi.fn().mockResolvedValue(orders),
  getOrder: vi.fn().mockResolvedValue(orders[0]),
  markPaid: vi.fn().mockResolvedValue({ ...orders[0], paid: true }),
});

const show = (entry: string, client: OrdersClient) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<p>Do Something page</p>} />
        <Route path="/orders" element={<OrdersPage client={client} />} />
        <Route path="/orders/:orderId" element={<OrderPage client={client} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("the supplier's orders", () => {
  it("lists open yeses and orders with the farmer, amount, date and total, and paid on its own tab", async () => {
    show("/orders", clientOf([asha, auma], [yes]));
    expect(await screen.findByText("Asha Otieno")).toBeInTheDocument();
    expect(screen.getByText("2 of Urea 50kg · Friday, 6 Nov")).toBeInTheDocument();
    expect(screen.getByText("KES 7,600")).toBeInTheDocument();
    expect(screen.getByText("Baraka Njeri")).toBeInTheDocument();
    expect(screen.getByText("3 of DAP 50kg · Monday, 9 Nov")).toBeInTheDocument();
    expect(screen.queryByText("Auma Oluoch")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open · 2" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Paid · 1" }));
    expect(screen.getByText("Auma Oluoch")).toBeInTheDocument();
    expect(screen.queryByText("Asha Otieno")).not.toBeInTheDocument();
  });

  it("says so when nothing is open", async () => {
    show("/orders", clientOf([]));
    expect(await screen.findByText("No open yeses or orders")).toBeInTheDocument();
  });

  it("says No paid orders yet in an empty card on the Paid tab when none is paid, and not the open line", async () => {
    show("/orders", clientOf([asha]));
    await userEvent.click(await screen.findByRole("button", { name: "Paid · 0" }));
    expect(screen.getByText("No paid orders yet").closest(".card")).toHaveClass("empty");
    expect(screen.queryByText("No open yeses or orders")).toBeNull();
    expect(screen.queryByText("Asha Otieno")).toBeNull();
  });

  it("says when the orders could not be loaded", async () => {
    const client = clientOf([]);
    (client.listOrders as any).mockRejectedValue(new Error("down"));
    show("/orders", client);
    expect(await screen.findByText("Your orders could not be loaded.")).toBeInTheDocument();
  });

  it("opens one order with the price it was made at and marks it paid", async () => {
    const client = clientOf([asha]);
    show("/orders", client);
    await userEvent.click(await screen.findByText("Asha Otieno"));
    expect(await screen.findByText("KES 3,800 each · KES 7,600 in all")).toBeInTheDocument();
    expect(client.getOrder).toHaveBeenCalledWith("or1");
    expect(screen.getByText("Open")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mark paid" }));
    expect(client.markPaid).toHaveBeenCalledWith("or1");
    expect(await screen.findByText("Paid")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark paid" })).not.toBeInTheDocument();
  });

  it("shows the note of the yes an order came from, beside the date he gave", async () => {
    const fromYes: SupplyOrder = { ...asha, yesId: "y9", promisedDate: "2026-11-06" };
    const client = clientOf([fromYes], [{ ...yes, id: "y9", note: "Collect at the shop", state: "closed" }]);
    show("/orders/or1", client);
    expect(await screen.findByText("Date he gave")).toBeInTheDocument();
    expect(await screen.findByText("Collect at the shop")).toBeInTheDocument();
    expect(screen.getByText("Friday, 6 Nov", { selector: ".meta" })).toBeInTheDocument();
  });

  it("shows the date alone when the yes cannot be read", async () => {
    const fromYes: SupplyOrder = { ...asha, yesId: "y9", promisedDate: "2026-11-06" };
    const client = clientOf([fromYes]);
    (client.listYeses as any).mockRejectedValue(new Error("down"));
    show("/orders/or1", client);
    expect(await screen.findByText("Friday, 6 Nov", { selector: ".meta" })).toBeInTheDocument();
    expect(screen.queryByText("Collect at the shop")).not.toBeInTheDocument();
  });

  it("marks a yes row with a Yes chip and opens nothing from it", async () => {
    show("/orders", clientOf([asha], [{ ...yes, note: "Collect at the shop" }]));
    const row = (await screen.findByText("Baraka Njeri")).closest(".row") as HTMLElement;
    expect(row.tagName).toBe("DIV");
    expect(within(row).getByText("Yes")).toBeInTheDocument();
    expect(within(row).getByText("Collect at the shop")).toBeInTheDocument();
    expect(screen.getByText("Asha Otieno").closest(".row")?.tagName).toBe("BUTTON");
  });

  it("offers no Mark paid on an order that is already paid", async () => {
    show("/orders/or2", clientOf([auma]));
    expect(await screen.findByText("Paid")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark paid" })).not.toBeInTheDocument();
  });

  it("keeps the order open and says so when marking fails", async () => {
    const client = clientOf([asha]);
    (client.markPaid as any).mockRejectedValue(new Error("refused"));
    show("/orders/or1", client);
    await userEvent.click(await screen.findByRole("button", { name: "Mark paid" }));
    expect(await screen.findByText("Could not mark this order paid. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark paid" })).toBeInTheDocument();
  });
});

describe("the orders client", () => {
  it("reads the tool results into orders and yeses", () => {
    expect(orderTotal(orderOf({ quantity: 2, unit_price: 3800, paid: true, picker: "m9" }))).toBe(7600);
    expect(yesOf({ id: "y1", poster_id: "p1", picker: "m9", quantity: 3 }).supplierId).toBe("p1");
  });

  it("calls the market tools by name with the order id", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [] } as any);
    await mcpOrdersClient.listYeses();
    await mcpOrdersClient.listOrders();
    await mcpOrdersClient.getOrder("or1");
    await mcpOrdersClient.markPaid("or1");
    expect(call.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      ["market_list_yeses", {}],
      ["market_list_orders", {}],
      ["market_get_order", { orderID: "or1" }],
      ["market_mark_paid", { orderID: "or1" }],
    ]);
    call.mockRestore();
  });
});

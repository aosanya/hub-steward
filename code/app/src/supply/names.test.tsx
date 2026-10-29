import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as mcp from "../wakala/mcp";
import { listAsks } from "../chat/api";
import { AskForm } from "./asks/AskForm";
import { noStock } from "./asks/stock";
import { lineOf } from "./groupOrder/api";
import { orderOf, type OrdersClient } from "./orders/api";
import { OrderPage } from "./orders/OrderPage";

const clientOf = (order: ReturnType<typeof orderOf>): OrdersClient => ({
  listYeses: vi.fn().mockResolvedValue([]),
  listOrders: vi.fn().mockResolvedValue([order]),
  getOrder: vi.fn().mockResolvedValue(order),
  markPaid: vi.fn().mockResolvedValue({ ...order, paid: true }),
});

const showOrder = (raw: object) =>
  render(
    <MemoryRouter initialEntries={["/orders/or1"]}>
      <Routes>
        <Route path="/orders/:orderId" element={<OrderPage client={clientOf(orderOf({ id: "or1", ...raw }))} />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => vi.restoreAllMocks());

describe("farmer names", () => {
  it("shows the picker name on the ask card", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [{ id: "a1", picker: "pk-1", picker_name: "Asha Otieno", question: "2 bags?" }] });
    const [ask] = await listAsks();
    render(<AskForm ask={ask} readStock={noStock} onAnswer={async () => {}} />);
    expect(screen.getByText("Asha Otieno")).toBeInTheDocument();
    expect(screen.queryByText("pk-1")).not.toBeInTheDocument();
  });

  it("falls back to the id on the ask card when the name is empty", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [{ id: "a1", picker: "pk-1", picker_name: "", question: "2 bags?" }] });
    const [ask] = await listAsks();
    render(<AskForm ask={ask} readStock={noStock} onAnswer={async () => {}} />);
    expect(screen.getByText("pk-1")).toBeInTheDocument();
  });

  it("shows the picker name on a group order line and falls back to the id", () => {
    expect(lineOf({ id: "l1", picker: "pk-1", picker_name: "Auma Oluoch" }).picker).toBe("Auma Oluoch");
    expect(lineOf({ id: "l2", picker: "pk-2", picker_name: "" }).picker).toBe("pk-2");
  });

  it("shows the picker name on the order card", async () => {
    showOrder({ picker: "pk-1", picker_name: "Baraka Njeri", product: "DAP", quantity: 1, unit_price: 100 });
    expect(await screen.findByRole("heading", { name: "Baraka Njeri" })).toBeInTheDocument();
  });

  it("falls back to the id on the order card when the name is empty", async () => {
    showOrder({ picker: "pk-1", picker_name: "", product: "DAP", quantity: 1, unit_price: 100 });
    expect(await screen.findByRole("heading", { name: "pk-1" })).toBeInTheDocument();
  });

  it("shows the date he gave when the order has one", async () => {
    showOrder({ picker: "pk-1", yes_id: "y1", promised_date: "2026-11-09", product: "DAP", quantity: 1, unit_price: 100 });
    expect(await screen.findByText("Date he gave")).toBeInTheDocument();
    expect(screen.getByText("Monday, 9 Nov")).toBeInTheDocument();
  });

  it("shows no date he gave when the order has none", async () => {
    showOrder({ picker: "pk-1", promised_date: "", product: "DAP", quantity: 1, unit_price: 100 });
    await screen.findByText("Mark paid");
    expect(screen.queryByText("Date he gave")).not.toBeInTheDocument();
  });
});

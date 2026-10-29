import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { listAskRecords, mcpStockClient, mcpStockReader, type StockClient } from "./api";
import { StockPage } from "./StockPage";
import * as mcp from "../../wakala/mcp";
import type { Supplier, SupplyClient, SupplyOffer } from "../api";

const supplier = (status: string): Supplier => ({
  id: "p1",
  shop: "Kisumu Agro Supplies",
  area: "Kisumu",
  sells: "Fertiliser",
  owner: "m1",
  status,
  approvedBy: "",
  ownerName: "",
  approvedByName: "",
});

const offer = (id: string, product: string): SupplyOffer => ({
  id,
  supplierId: "p1",
  product,
  unit: "bag",
  price: 3000,
  bulkFrom: 0,
  bulkPrice: 0,
});

const clients = (status = "approved") => {
  const supply = {
    listSuppliers: vi.fn().mockResolvedValue([supplier(status)]),
    listOffers: vi.fn().mockResolvedValue([offer("o1", "DAP fertiliser"), offer("o2", "Maize seed")]),
  } as unknown as SupplyClient;
  const stock: StockClient = {
    getStock: vi.fn().mockResolvedValue([{ product: "DAP fertiliser", count: 40 }]),
    setStock: vi.fn().mockResolvedValue(undefined),
  };
  return { supply, stock };
};

const show = (supply: SupplyClient, stock: StockClient) =>
  render(
    <MemoryRouter>
      <StockPage client={supply} stock={stock} me="m1" />
    </MemoryRouter>,
  );

describe("the supplier's stock list", () => {
  it("shows a count in bags for each product and says only he sees it", async () => {
    const { supply, stock } = clients();
    show(supply, stock);
    expect(await screen.findByText("Only you see this list")).toBeTruthy();
    expect((screen.getByLabelText("DAP fertiliser (bags)") as HTMLInputElement).value).toBe("40");
    expect((screen.getByLabelText("Maize seed (bags)") as HTMLInputElement).value).toBe("0");
  });

  it("saves every product's count", async () => {
    const { supply, stock } = clients();
    show(supply, stock);
    fireEvent.change(await screen.findByLabelText("Maize seed (bags)"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Save list" }));
    await screen.findByText("List saved");
    expect(stock.setStock).toHaveBeenCalledWith("p1", { product: "DAP fertiliser", count: 40 });
    expect(stock.setStock).toHaveBeenCalledWith("p1", { product: "Maize seed", count: 12 });
  });

  it("refuses a count that is not a whole number and saves nothing", async () => {
    const { supply, stock } = clients();
    show(supply, stock);
    fireEvent.change(await screen.findByLabelText("Maize seed (bags)"), { target: { value: "lots" } });
    fireEvent.click(screen.getByRole("button", { name: "Save list" }));
    await screen.findByText(/was not saved/);
    expect(stock.setStock).not.toHaveBeenCalled();
  });

  it("flags a count that is not a whole number on its own field", async () => {
    const { supply, stock } = clients();
    show(supply, stock);
    const maize = await screen.findByLabelText("Maize seed (bags)");
    expect(maize.getAttribute("aria-invalid")).toBeNull();
    fireEvent.change(maize, { target: { value: "lots" } });
    expect(maize.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Use a whole number")).toBeTruthy();
    expect(screen.getByLabelText("DAP fertiliser (bags)").getAttribute("aria-invalid")).toBeNull();
  });

  it("says so when saving fails", async () => {
    const { supply, stock } = clients();
    (stock.setStock as any).mockRejectedValue(new Error("no"));
    show(supply, stock);
    await screen.findByLabelText("Maize seed (bags)");
    fireEvent.click(screen.getByRole("button", { name: "Save list" }));
    await screen.findByText(/was not saved/);
  });

  it("stays closed until the application is approved", async () => {
    const { supply, stock } = clients("pending");
    show(supply, stock);
    await screen.findByText(/opens once the group coordinator approves/);
    expect(stock.getStock).not.toHaveBeenCalled();
  });
});

describe("the stock list that cannot be shown", () => {
  it("announces Your stock list could not be loaded. in the failure card and offers no Save list", async () => {
    const { supply, stock } = clients();
    (supply.listSuppliers as any).mockRejectedValue(new Error("down"));
    show(supply, stock);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your stock list could not be loaded.");
    expect(alert.closest(".card")).toHaveClass("empty");
    expect(screen.queryByRole("button", { name: "Save list" })).toBeNull();
  });

  it("says the whole line in an empty card, with no alert, until the application is approved", async () => {
    const { supply, stock } = clients("pending");
    show(supply, stock);
    const line = await screen.findByText("The stock list opens once the group coordinator approves your application.");
    expect(line.closest(".card")).toHaveClass("empty");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save list" })).toBeNull();
  });

  it("says No products yet in an empty card with Add an offer inside it when the supplier lists nothing", async () => {
    const { supply, stock } = clients();
    (supply.listOffers as any).mockResolvedValue([]);
    (stock.getStock as any).mockResolvedValue([]);
    show(supply, stock);
    const card = (await screen.findByText("No products yet")).closest(".card") as HTMLElement;
    expect(card).toHaveClass("empty");
    expect(within(card).getByText("Add an offer first, then count it here.")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Add an offer" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save list" })).toBeNull();
  });
});

describe("the stock client", () => {
  it("reads and writes through the market tools", async () => {
    const call = vi
      .spyOn(mcp, "callTool")
      .mockResolvedValueOnce({ items: [{ product: "DAP fertiliser", count: 40 }] } as any)
      .mockResolvedValueOnce({} as any);
    expect(await mcpStockClient.getStock("p1")).toEqual([{ product: "DAP fertiliser", count: 40 }]);
    await mcpStockClient.setStock("p1", { product: "DAP fertiliser", count: 35 });
    expect(call).toHaveBeenNthCalledWith(1, "", "market_get_stock", { posterID: "p1" });
    expect(call).toHaveBeenNthCalledWith(2, "", "market_set_stock", { poster_id: "p1", product: "DAP fertiliser", count: 35 });
    call.mockRestore();
  });

  it("gives the ask page the asked product's count and promises, or nothing without a list", async () => {
    const { supply, stock } = clients();
    (stock.getStock as any).mockResolvedValue([
      { product: "Urea 50kg", count: 40 },
      { product: "DAP 50kg", count: 5 },
    ]);
    const urea = { question: "2 bags of Urea 50kg", detail: "" };
    expect(await mcpStockReader(stock, supply, "m1", async () => [])(urea)).toEqual({ listed: 40, promised: 0, unit: "bags" });
    const yes = (what: string, state: string, quantity: number) => ({ id: "y", askId: "a", supplierId: "p1", picker: "m2", what, quantity, date: "2026-11-06", note: "", state });
    const yeses = async () => [
      yes("Urea 50kg", "open", 2),
      yes("Urea 50kg", "open", 3),
      yes("Urea 50kg", "delivered", 7),
      yes("DAP 50kg", "open", 11),
    ];
    expect(await mcpStockReader(stock, supply, "m1", yeses)(urea)).toEqual({ listed: 40, promised: 5, unit: "bags" });
    expect(await mcpStockReader(stock, supply, "m1", yeses)({ question: "dap", detail: "DAP 50kg by Friday" })).toEqual({
      listed: 5,
      promised: 11,
      unit: "bags",
    });
    expect(await mcpStockReader(stock, supply, "m1", yeses)({ question: "Maize seed", detail: "" })).toBeNull();
    (stock.getStock as any).mockResolvedValue([]);
    expect(await mcpStockReader(stock, supply, "m1")(urea)).toBeNull();
    const pending = clients("pending");
    expect(await mcpStockReader(pending.stock, pending.supply, "m1")(urea)).toBeNull();
  });

  it("falls back to the only product listed when the ask names none", async () => {
    const { supply, stock } = clients();
    (stock.getStock as any).mockResolvedValue([{ product: "Urea 50kg", count: 40 }]);
    expect(await mcpStockReader(stock, supply, "m1", async () => [])({ question: "Fertiliser", detail: "" })).toEqual({
      listed: 40,
      promised: 0,
      unit: "bags",
    });
  });

  it("matches the stock name as a whole word, so 'Price for beans?' does not show rice", async () => {
    const { supply, stock } = clients();
    (stock.getStock as any).mockResolvedValue([
      { product: "rice", count: 9 },
      { product: "maize", count: 20 },
    ]);
    const read = mcpStockReader(stock, supply, "m1", async () => []);
    expect(await read({ question: "Price for beans?", detail: "" })).toBeNull();
    expect(await read({ question: "Do you have Rice?", detail: "" })).toEqual({ listed: 9, promised: 0, unit: "bags" });
    expect(await read({ question: "Two sacks of maizes", detail: "" })).toEqual({ listed: 20, promised: 0, unit: "bags" });
  });

  it("joins each open yes to its ask when the yes carries no product words", async () => {
    const { supply, stock } = clients();
    (stock.getStock as any).mockResolvedValue([
      { product: "Urea 50kg", count: 40 },
      { product: "Maize seed", count: 8 },
    ]);
    const yes = (id: string, askId: string, quantity: number, state = "open", what = "") => ({
      id,
      askId,
      supplierId: "p1",
      picker: "m2",
      what,
      quantity,
      date: "2026-11-06",
      note: "",
      state,
    });
    const yeses = async () => [
      yes("y1", "a1", 2),
      yes("y2", "a2", 4),
      yes("y3", "a3", 5),
      yes("y4", "a1", 7, "delivered"),
      yes("y5", "a9", 100),
      yes("y6", "a4", 1, "open", "Urea 50kg"),
    ];
    const asks = async () => [
      { id: "a1", offerId: "", product: "", question: "2 bags of Urea 50kg", detail: "" },
      { id: "a2", offerId: "", product: "", question: "Maize seed", detail: "" },
      { id: "a3", offerId: "o1", product: "", question: "Is it in stock?", detail: "" },
      { id: "a4", offerId: "", product: "", question: "Anything", detail: "" },
    ];
    (supply.listOffers as any).mockResolvedValue([offer("o1", "Urea 50kg")]);
    const urea = { question: "Urea 50kg", detail: "" };
    expect(await mcpStockReader(stock, supply, "m1", yeses, asks)(urea)).toEqual({ listed: 40, promised: 8, unit: "bags" });
    expect(await mcpStockReader(stock, supply, "m1", yeses, asks)({ question: "Maize seed", detail: "" })).toEqual({
      listed: 8,
      promised: 4,
      unit: "bags",
    });
  });

  it("reads the asks through the market tool", async () => {
    const call = vi
      .spyOn(mcp, "callTool")
      .mockResolvedValueOnce({ items: [{ id: "a1", offer_id: "o1", question: "2 bags", detail: "d", product: "Urea" }] } as any);
    expect(await listAskRecords()).toEqual([{ id: "a1", offerId: "o1", product: "Urea", question: "2 bags", detail: "d" }]);
    expect(call).toHaveBeenCalledWith("", "market_list_asks", {});
    call.mockRestore();
  });
});

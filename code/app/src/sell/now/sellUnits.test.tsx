import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { bulkWords, priceOf, saleFrom, saleQuestion, type BuyerPrice, type Sale, type SellClient } from "./api";
import { SalePage } from "./SalePage";
import { SellNowPage } from "./SellNowPage";

const oil: BuyerPrice = {
  id: "o9",
  buyerId: "b9",
  buyer: "Lakeside Oil Traders",
  product: "cooking-oil",
  words: "Cooking oil 20 litre",
  unit: "litre",
  price: 85,
  bulkPrice: 80,
  bulkFrom: 20,
};

const oilSale: Sale = {
  id: "a9",
  orderId: "",
  offerId: "o9",
  yesId: "",
  answer: "waiting",
  buyerId: "b9",
  buyer: "Lakeside Oil Traders",
  product: "cooking-oil",
  unit: "litre",
  quantity: 20,
  unitPrice: 85,
  state: "asked",
  promisedDate: "",
};

const clientOf = (): SellClient => ({
  listProducts: vi.fn().mockResolvedValue([]),
  listPrices: vi.fn().mockResolvedValue([oil]),
  listGroupSales: vi.fn().mockResolvedValue([]),
  sellNow: vi.fn().mockResolvedValue(oilSale),
  getSale: vi.fn().mockResolvedValue(oilSale),
  bookSale: vi.fn().mockResolvedValue(undefined),
});

const show = (entry: string, client: SellClient) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/sell/:productId/now/:offerId" element={<SellNowPage client={client} />} />
        <Route path="/sell/sale/:saleId" element={<SalePage client={client} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("a litre offer on the sell screens", () => {
  it("reads the unit from the buyer's offer and the sale's offer", () => {
    expect(priceOf({ id: "o9", poster_id: "b9", product: "cooking-oil", unit_words: "litre", price: 85 }, new Map()).unit).toBe("litre");
    const sale = saleFrom({ id: "a9", offer_id: "o9", question: "20 litres of Cooking oil" }, new Map(), [{ id: "o9", unit_words: "litre", price: 85 }], [], []);
    expect(sale.unit).toBe("litre");
  });

  it("words the bulk price and the question to the buyer in litres", () => {
    expect(bulkWords(oil)).toBe("Bulk price KES 80 a litre from 20 litres");
    expect(saleQuestion(20, "litre", "Cooking oil 20 litre")).toBe("20 litres of Cooking oil 20 litre");
  });

  it("prices the form a litre and asks for litres", async () => {
    const client = clientOf();
    show("/sell/cooking-oil/now/o9", client);
    expect(await screen.findByText("KES 85 a litre")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Litres"), "20");
    await userEvent.click(screen.getByRole("button", { name: "Sell now" }));
    expect(client.sellNow).toHaveBeenCalledWith("o9", 20);
  });

  it("asks for litres when none is typed", async () => {
    show("/sell/cooking-oil/now/o9", clientOf());
    await userEvent.click(await screen.findByRole("button", { name: "Sell now" }));
    expect(await screen.findByText("Enter how many litres.")).toBeInTheDocument();
  });

  it("titles the sale in litres at the litre price", async () => {
    show("/sell/sale/a9", clientOf());
    expect(await screen.findByRole("heading", { level: 1, name: /20 litres of/ })).toBeInTheDocument();
    expect(await screen.findByText(/KES 85 a litre, the price when you sold/)).toBeInTheDocument();
  });
});

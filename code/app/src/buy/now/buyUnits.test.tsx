import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { buyOfferOf, buyOrderOf, type BuyNowClient, type BuyOffer, type BuyOrder } from "./api";
import { BuyNowPage } from "./BuyNowPage";
import { BuyOrderPage } from "./BuyOrderPage";
import { agentLine } from "./standing";
import { routes } from "../../routes";
import { forgetOpenAgency, openAgency } from "../../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const oil: BuyOffer = {
  id: "o9",
  posterId: "p9",
  shop: "Lakeside Oil Traders",
  words: "Cooking oil 20 litre",
  product: "cooking-oil",
  unit: "litre",
  unitPrice: 85,
};

const oilOrder: BuyOrder = {
  id: "or9",
  posterId: "p9",
  shop: "Lakeside Oil Traders",
  product: "Cooking oil 20 litre",
  unit: "litre",
  quantity: 20,
  unitPrice: 85,
  state: "placed",
  promisedDate: "",
  paid: false,
};

const clientOf = (): BuyNowClient => ({
  getOffer: vi.fn().mockResolvedValue(oil),
  buyNow: vi.fn().mockResolvedValue(oilOrder),
  getOrder: vi.fn().mockResolvedValue(oilOrder),
  cancelOrder: vi.fn().mockResolvedValue(oilOrder),
});

const show = (entry: string, client: BuyNowClient) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path={routes.buyNow.pattern} element={<BuyNowPage client={client} />} />
        <Route path={routes.marketOrder.pattern} element={<BuyOrderPage client={client} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("a litre offer on the buy now screens", () => {
  it("reads the unit from the offer and from the offer an order was placed on", () => {
    expect(buyOfferOf({ id: "o9", unit_words: "litre", price: 85 }).unit).toBe("litre");
    expect(buyOrderOf({ id: "or9", quantity: 20 }, "Lakeside Oil Traders", "Cooking oil 20 litre", "litre").unit).toBe("litre");
  });

  it("prices the offer a litre and asks how many litres", async () => {
    const client = clientOf();
    show("/a/farmers/market/cooking-oil/buy/o9", client);
    expect(await screen.findByText("Cooking oil 20 litre · Lakeside Oil Traders · KES 85 a litre")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("How many litres"), "20");
    await userEvent.click(screen.getByRole("button", { name: "Buy now" }));
    expect(client.buyNow).toHaveBeenCalledWith("o9", 20, undefined);
  });

  it("titles the order in litres at the litre price", async () => {
    show("/a/farmers/market/orders/or9", clientOf());
    expect(await screen.findByRole("heading", { level: 1, name: "20 litres of Cooking oil 20 litre" })).toBeInTheDocument();
    expect(screen.getByText("KES 85 a litre")).toBeInTheDocument();
  });

  it("tells the agent's line in litres", () => {
    expect(agentLine(oilOrder)).toBe("Asking Lakeside Oil Traders about 20 litres.");
  });
});

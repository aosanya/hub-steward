import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { OffersPage } from "../pages/supply/OffersPage";
import type { BuyerAsk, BuyerAskClient } from "../sell/group/buyerAsksApi";
import type { SupplyClient, SupplyOffer, Supplier } from "./api";

const shop: Supplier = { id: "p1", shop: "Kisumu Grain Traders", area: "", sells: "", owner: "m1", status: "approved", approvedBy: "", ownerName: "", approvedByName: "" };
const offer: SupplyOffer = { id: "o1", supplierId: "p1", product: "Dry maize 90kg", unit: "bag", price: 4200, bulkFrom: 100, bulkPrice: 4350 };
const ask = (id: string, answer: string): BuyerAsk => ({ id, posterId: "p1", offerId: "", asker: "Asha Otieno", question: `Asha Otieno has ${id} bags of maize ready`, answer, detail: "" });

const supply = { listSuppliers: async () => [shop], listOffers: async () => [offer] } as unknown as SupplyClient;
const asksOf = (list: BuyerAsk[] | Error): BuyerAskClient => ({
  list: async () => {
    if (list instanceof Error) throw list;
    return list;
  },
  offers: async () => [],
  answer: async () => undefined,
});

const show = (path: string, asks: BuyerAskClient, buyer = true) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={<OffersPage client={supply} asks={asks} me="m1" buyer={buyer} />} />
        <Route path="/sell/asks/:askId" element={<p>the ask</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("the buyer's Your prices page", () => {
  it("lists the asks waiting beside his prices and leaves answered ones out", async () => {
    show("/prices", asksOf([ask("40", "waiting"), ask("12", "yes"), ask("7", "")]));
    expect(await screen.findByText("Dry maize 90kg")).toBeInTheDocument();
    expect(await screen.findByText("Asks waiting · 2")).toBeInTheDocument();
    expect(screen.getByText("Asha Otieno has 40 bags of maize ready")).toBeInTheDocument();
    expect(screen.queryByText("Asha Otieno has 12 bags of maize ready")).toBeNull();
  });

  it("opens an ask from the page", async () => {
    show("/prices", asksOf([ask("40", "waiting")]));
    await userEvent.click(await screen.findByRole("button", { name: /Asha Otieno has 40 bags/ }));
    expect(await screen.findByText("the ask")).toBeInTheDocument();
  });

  it("says nothing about asks when none are waiting or they cannot be read", async () => {
    show("/prices", asksOf(new Error("down")));
    expect(await screen.findByText("Dry maize 90kg")).toBeInTheDocument();
    expect(screen.queryByText(/Asks waiting/)).toBeNull();
  });

  it("does not read asks for the supplier's Offers page", async () => {
    const asks = asksOf([ask("40", "waiting")]);
    const list = vi.spyOn(asks, "list");
    show("/offers", asks, false);
    expect(await screen.findByText("Dry maize 90kg")).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
    expect(screen.queryByText(/Asks waiting/)).toBeNull();
  });
});

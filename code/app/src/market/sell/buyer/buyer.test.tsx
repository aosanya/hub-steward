import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Supplier, SupplyClient } from "../../supply/api";
import type { BuyerAsk, BuyerAskClient } from "../group/buyerAsksApi";
import { BuyerHome } from "./BuyerHome";
import { BuyerTabs } from "./BuyerTabs";

const poster = (status: string, owner = "m1"): Supplier => ({
  id: "p1",
  shop: "Kisumu Maize Buyers",
  area: "Kisumu",
  sells: "Dry maize",
  owner,
  status,
  approvedBy: "",
  ownerName: "",
  approvedByName: "",
});

const supplyOf = (posters: Supplier[]): SupplyClient => ({
  listSuppliers: vi.fn().mockResolvedValue(posters),
  applySupplier: vi.fn(),
  listOffers: vi.fn().mockResolvedValue([]),
  createOffer: vi.fn(),
  updateOffer: vi.fn(),
});

const ask = (id: string, answer: string): BuyerAsk => ({
  id,
  posterId: "p1",
  asker: "Asha Otieno",
  question: "Asha Otieno has 40 bags of maize ready",
  answer,
  detail: "",
});

const asksOf = (asks: BuyerAsk[]): BuyerAskClient => ({
  list: vi.fn().mockResolvedValue(asks),
  answer: vi.fn().mockResolvedValue(undefined),
});

const home = (supply: SupplyClient, asks: BuyerAskClient) =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<BuyerHome client={supply} askClient={asks} me="m1" />} />
        <Route path="/prices" element={<p>prices page</p>} />
        <Route path="/sell/asks" element={<p>asks page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("the buyer's Do Something entry", () => {
  it("shows Your prices and the count of asks waiting for an approved poster", async () => {
    home(supplyOf([poster("approved")]), asksOf([ask("a1", "waiting"), ask("a2", ""), ask("a3", "yes")]));
    expect(await screen.findByText("2 waiting")).toBeInTheDocument();
    expect(screen.getByText("Your prices", { selector: ".ttl" })).toBeInTheDocument();
  });

  it("says none are waiting when every ask is answered", async () => {
    home(supplyOf([poster("approved")]), asksOf([ask("a3", "no")]));
    expect(await screen.findByText("None waiting")).toBeInTheDocument();
  });

  it("still shows the entry when the asks cannot be counted", async () => {
    const asks = asksOf([]);
    (asks.list as any).mockRejectedValue(new Error("down"));
    home(supplyOf([poster("approved")]), asks);
    expect(await screen.findByText("Asks waiting")).toBeInTheDocument();
    expect(document.querySelector(".meta")).toBeNull();
  });

  it("shows nothing before approval or for someone else's poster", async () => {
    const pending = supplyOf([poster("pending")]);
    const view = home(pending, asksOf([]));
    await vi.waitFor(() => expect(pending.listSuppliers).toHaveBeenCalled());
    expect(screen.queryByText("Asks waiting")).not.toBeInTheDocument();
    view.unmount();
    const other = supplyOf([poster("approved", "m2")]);
    home(other, asksOf([]));
    await vi.waitFor(() => expect(other.listSuppliers).toHaveBeenCalled());
    expect(screen.queryByText("Asks waiting")).not.toBeInTheDocument();
  });

  it("opens the prices and the asks from the two rows", async () => {
    home(supplyOf([poster("approved")]), asksOf([]));
    await userEvent.click(await screen.findByText("Asks waiting"));
    expect(screen.getByText("asks page")).toBeInTheDocument();
  });

  it("opens Your prices from its row", async () => {
    home(supplyOf([poster("approved")]), asksOf([]));
    await userEvent.click(await screen.findByText("Your prices", { selector: ".ttl" }));
    expect(screen.getByText("prices page")).toBeInTheDocument();
  });
});

describe("the buyer's tab strip", () => {
  const strip = (active: "prices" | "asks", entry: string) =>
    render(
      <MemoryRouter initialEntries={[entry]}>
        <BuyerTabs active={active} />
        <Routes>
          <Route path="/prices" element={<p>prices page</p>} />
          <Route path="/sell/asks" element={<p>asks page</p>} />
        </Routes>
      </MemoryRouter>,
    );

  it("marks the active tab and moves to the other", async () => {
    strip("prices", "/prices");
    expect(screen.getByRole("button", { name: "Your prices" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Asks" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "Asks" }));
    expect(screen.getByText("asks page")).toBeInTheDocument();
  });

  it("goes back to the prices from the asks tab", async () => {
    strip("asks", "/sell/asks");
    expect(screen.getByRole("button", { name: "Asks" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Your prices" }));
    expect(screen.getByText("prices page")).toBeInTheDocument();
  });
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import * as mcp from "../wakala/mcp";
import { forgetSubject } from "../wakala/me";
import { buyer, farmer, world } from "./walk16.test-support";
import { openAgency } from "../agency/open";
import { agenciesFrom, answerWakala } from "./answerWakala";

beforeEach(() => openAgency("walk-agency"));

let who = farmer.id;
const walk = world(() => who);

const as = (id: string) => {
  who = id;
  forgetSubject();
};

const open = (path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

const openDoSomething = async () => {
  open("/do-something");
  await screen.findByRole("heading", { level: 1 });
};

const press = async (name: string | RegExp) => userEvent.click(await screen.findByRole("button", { name }));

const startRow = async (name: string | RegExp) => userEvent.click(await screen.findByRole("button", { name }));

const doSomethingShown = () => screen.findByRole("heading", { name: "Start a task", level: 1 });

const fill = async (label: string, value: string) => userEvent.type(await screen.findByLabelText(label), value);

const kisumuCard = async () => (await screen.findAllByText(buyer.name))[0].closest(".card") as HTMLElement;

beforeAll(() => {
  vi.stubGlobal("fetch", answerWakala(() => who, agenciesFrom((hub, tool, args) => walk.call(hub, tool, args))));
  vi.spyOn(mcp, "callTool").mockImplementation(((hub: string, tool: string, args: Record<string, unknown>) => walk.call(hub, tool, args)) as any);
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  forgetSubject();
});

describe("journey 16, sell the harvest", () => {
  it("step 1: Start carries a Sell harvest row", async () => {
    as(farmer.id);
    await openDoSomething();
    await doSomethingShown();
    await startRow(/Sell harvest/);
    expect(await screen.findByRole("heading", { name: "Sell harvest", level: 1 })).toBeInTheDocument();
  });

  it("step 1: the Sell harvest list names the product in the buyers' words with its shops and lowest price, and opens its prices", async () => {
    as(farmer.id);
    open("/sell");
    const row = await screen.findByRole("button", { name: /MAIZE grain \(bag\)/ });
    expect(within(row).getByText("2 shops · from KES 3,900")).toBeInTheDocument();
    await userEvent.click(row);
    expect(await screen.findByRole("heading", { name: "MAIZE grain (bag)" })).toBeInTheDocument();
    await kisumuCard();
  });

  it("step 1: the maize page shows each buyer's price, best first, with the bulk price and the open group sale", async () => {
    as(farmer.id);
    open("/sell/maize");
    const kisumu = await kisumuCard();
    expect(within(kisumu).getByText("Dry maize 90kg")).toBeInTheDocument();
    expect(within(kisumu).getByText("KES 4,200 a bag")).toBeInTheDocument();
    expect(within(kisumu).getByText("Bulk price KES 4,350 a bag from 100 bags")).toBeInTheDocument();
    expect(within(kisumu).getByText("Group sale open KES 4,350 a bag from 100 bags")).toBeInTheDocument();
    expect(within(kisumu).getByRole("button", { name: "Join" })).toBeInTheDocument();
    const cards = Array.from(document.querySelectorAll(".card"));
    expect(cards.map((card) => card.querySelector(".ttl")?.textContent)).toEqual([buyer.name, "Siaya Millers"]);
    expect(screen.getByText("KES 3,900 a bag")).toBeInTheDocument();
    expect(walk.store.asks).toEqual([]);
  });

  it("step 1: Sell now asks the buyer once and the sale waits for his own yes, with no order yet", async () => {
    as(farmer.id);
    open("/sell/maize");
    await userEvent.click(within(await kisumuCard()).getByRole("button", { name: "Sell now" }));
    expect(await screen.findByRole("heading", { name: "Sell now" })).toBeInTheDocument();
    expect(screen.getByText("KES 4,200 a bag")).toBeInTheDocument();
    await fill("Bags", "40");
    await press("Sell now");
    expect(await screen.findByText("I asked Kisumu Grain Traders once about 40 bags of MAIZE grain (bag). His yes is his own.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "40 bags of MAIZE grain (bag)" })).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("KES 168,000")).toBeInTheDocument();
    expect(screen.getByText("KES 4,200 a bag, the price when you sold")).toBeInTheDocument();
    expect(screen.queryByText("His date")).toBeNull();
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Back", "Menu", null]);
    expect(screen.getByRole("button", { name: "Cancel the sale" })).toBeInTheDocument();
    expect(walk.store.asks).toHaveLength(1);
    expect(walk.store.orders).toEqual([]);
    expect(walk.store.calls.map(([tool]) => tool)).not.toContain("market_buy_now");
  });

  it("step 1: the ask goes to the buyer she picked with the offer and the bags, under the market's declared names", async () => {
    expect(walk.store.calls).toContainEqual([
      "market_ask",
      expect.objectContaining({ poster_id: "b1", offer_id: "o1", kind: "sale", product: "maize", question: "40 bags of Dry maize 90kg", request_id: "r1" }),
    ]);
  });

  it("step 2: Join on the maize page opens the group sale", async () => {
    as(farmer.id);
    open("/sell/maize");
    await userEvent.click(within(await kisumuCard()).getByRole("button", { name: "Join" }));
    expect(await screen.findByText(/group sale/i, { selector: ".ttl" })).toBeInTheDocument();
  });

  it("step 2: joins the group sale with 40 bags and sees her own line and the new total, no other farmer", async () => {
    as(farmer.id);
    open("/sell/group/g1");
    expect(await screen.findByText("Dry maize 90kg group sale")).toBeInTheDocument();
    expect(screen.getByText("KES 4,350 a bag from 100 bags")).toBeInTheDocument();
    expect(screen.getByText(buyer.name)).toBeInTheDocument();
    expect(screen.getByText("62 bags so far · minimum 100 bags · 6 farmers")).toBeInTheDocument();
    expect(screen.queryByText("Your line")).toBeNull();
    await fill("Bags", "40");
    await press("Join");
    expect(await screen.findByText("Your line")).toBeInTheDocument();
    expect(screen.getByText("40 bags")).toBeInTheDocument();
    expect(screen.getByText("Joined")).toBeInTheDocument();
    expect(screen.getByText("102 bags so far · minimum 100 bags · 7 farmers")).toBeInTheDocument();
    expect(screen.queryByText("17 bags")).toBeNull();
    expect(walk.store.calls).toContainEqual(["market_join_group_order", { groupOrderID: "g1", quantity: 40 }]);
  });

  it("step 3: Start carries a Your prices row for the buyer", async () => {
    as(buyer.id);
    await openDoSomething();
    await doSomethingShown();
    await startRow(/Your prices/);
  });

  it("step 3: the buyer's Asks row in Start leads to the asks waiting for an answer", async () => {
    as(buyer.id);
    await openDoSomething();
    await doSomethingShown();
    await startRow(/^Asks/);
    expect(await screen.findByRole("heading", { name: "Asks" })).toBeInTheDocument();
    const row = await screen.findByRole("button", { name: /Asha Otieno/ });
    expect(within(row).getByText(farmer.name)).toBeInTheDocument();
    expect(within(row).getByText("40 bags of Dry maize 90kg")).toBeInTheDocument();
    expect(screen.queryByText(/@|\+254|phone/i)).toBeNull();
  });

  it("step 3: Your prices lists the asks waiting for an answer beside the prices", async () => {
    as(buyer.id);
    open("/prices");
    await screen.findByText("Dry maize 90kg");
    await screen.findByText("40 bags of Dry maize 90kg");
  });

  it("step 3: the buyer opening the ask sees his price and the total, KES 168,000, with Yes and No", async () => {
    as(buyer.id);
    open("/asks/a1");
    await screen.findByText("40 bags of Dry maize 90kg");
    await screen.findByText(/168,000/);
    expect(await screen.findByRole("button", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
  });

  it("step 3: Your prices lists the prices posted and Post a price adds one in the buyer's own words", async () => {
    as(buyer.id);
    open("/prices");
    expect(await screen.findByText("Dry maize 90kg")).toBeInTheDocument();
    expect(screen.getByText("KES 4,200 a bag · KES 4,350 from 100 bags")).toBeInTheDocument();
    await press("Post a price");
    expect(await screen.findByRole("heading", { name: "Post a price" })).toBeInTheDocument();
    for (const label of ["Product, in your words", "Unit", "Price (KES)", "Bulk from", "Bulk price (KES)"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    await fill("Product, in your words", "Maize, shelled");
    await fill("Unit", "bag");
    await fill("Price (KES)", "4000");
    await press("Post price");
    expect(await screen.findByText("Maize, shelled")).toBeInTheDocument();
    expect(screen.getByText("Dry maize 90kg")).toBeInTheDocument();
    expect(walk.store.offers.find((o) => o.product_words === "Maize, shelled")).toMatchObject({ poster_id: "b1", price: 4000 });
  });

  it("step 3: answers the ask with Yes, a date and a note, and the sale shows his date to Asha", async () => {
    as(buyer.id);
    await openDoSomething();
    await startRow(/^Asks/);
    await userEvent.click(await screen.findByRole("button", { name: /Asha Otieno/ }));
    expect(walk.store.asks[0].answer).toBe("waiting");
    await press("Yes");
    await fill("Date", "2026-11-06");
    await fill("Note", "We collect from your farm.");
    await press("Send yes");
    expect(await screen.findByText("You said yes.")).toBeInTheDocument();
    expect(walk.store.calls).toContainEqual(["market_answer_ask", { askID: "a1", answer: "yes", date: "2026-11-06", note: "We collect from your farm." }]);
    expect(walk.store.yeses[0]).toMatchObject({ ask_id: "a1", date: "2026-11-06" });
    expect(walk.store.orders).toEqual([]);
  });

  it("step 1 again: after the yes her sale makes the order from his yes and shows his date, the price it was made at and the total", async () => {
    as(farmer.id);
    open("/sell/sale/a1");
    expect(await screen.findByText("Kisumu Grain Traders said yes.")).toBeInTheDocument();
    await waitFor(() => expect(walk.store.orders).toHaveLength(1));
    expect(walk.store.calls).toContainEqual(["market_buy_now", { offerID: "o1", quantity: 40, yes_id: "y1" }]);
    expect(walk.store.orders[0]).toMatchObject({ yes_id: "y1", promised_date: "2026-11-06", quantity: 40, unit_price: 4200 });
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("Friday, 6 Nov")).toBeInTheDocument();
    expect(screen.getByText("KES 4,200 a bag, the price when you sold")).toBeInTheDocument();
    expect(screen.getByText("KES 168,000")).toBeInTheDocument();
  });

  it("step 1 again: she can reach her sale from the maize page without typing its address", async () => {
    as(farmer.id);
    open("/sell/maize");
    await kisumuCard();
    await screen.findByText(/40 bags of MAIZE grain \(bag\)/);
  });

  it("step 1 again: her sale has a Cancel the sale button of her own", async () => {
    as(farmer.id);
    open("/sell/sale/a1");
    await screen.findByText("Yes");
    await press("Cancel the sale");
    expect(await screen.findByText("You cancelled the sale to Kisumu Grain Traders.")).toBeInTheDocument();
    expect(walk.store.calls).toContainEqual(["market_cancel_order", { orderID: "or1" }]);
  });

  it("step 2 again: the confirmed group sale shows her share, KES 174,000 and the day to collect", async () => {
    walk.groupSaleConfirmed();
    as(farmer.id);
    open("/sell/group/g1");
    await screen.findByText("Confirmed");
    await screen.findByText("KES 174,000");
    await screen.findByText("Friday, 6 Nov");
  });
});

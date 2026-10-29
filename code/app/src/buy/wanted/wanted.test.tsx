import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import { AskedPage } from "./AskedPage";
import { AskShopsPage } from "./AskShopsPage";
import { NoticePage } from "./NoticePage";
import { WantedPage } from "./WantedPage";
import { askTicked } from "./askTicked";
import type { WantedClient } from "./api";
import { routes } from "../../routes";
import { forgetOpenAgency, openAgency } from "../../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const shops = [
  { id: "p1", name: "Siaya Farm Stores" },
  { id: "p2", name: "Bondo Agrovet" },
  { id: "p3", name: "Kisumu Agro Supplies" },
];

const wanted = { what: "Hybrid maize seed 614", quantity: "10", neededBy: "2026-11-06" };

const client = (over: Partial<WantedClient> = {}): WantedClient => ({
  createWanted: vi.fn().mockResolvedValue("r1"),
  listShops: vi.fn().mockResolvedValue(shops),
  ask: vi.fn().mockResolvedValue(undefined),
  listAsked: vi.fn().mockResolvedValue([]),
  listFound: vi.fn().mockResolvedValue([]),
  listOffers: vi.fn().mockResolvedValue([]),
  createNotice: vi.fn().mockResolvedValue("n1"),
  listNotices: vi.fn().mockResolvedValue([]),
  withdrawNotice: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const query = "what=Hybrid+maize+seed+614&quantity=10&by=2026-11-06";

const show = (c: WantedClient, entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/buy/wanted" element={<WantedPage client={c} />} />
        <Route path="/buy/wanted/:requestId/ask" element={<AskShopsPage client={c} />} />
        <Route path="/buy/wanted/:requestId" element={<AskedPage client={c} />} />
        <Route path="/buy/notices/:noticeId" element={<NoticePage client={c} />} />
        <Route path={routes.market.pattern} element={<p>buy inputs</p>} />
      </Routes>
    </MemoryRouter>,
  );

const renderWithBuyRoute = (c: WantedClient) =>
  render(
    <MemoryRouter initialEntries={[`/buy/wanted/r1?${query}`]}>
      <Routes>
        <Route path="/buy/wanted/:requestId" element={<AskedPage client={c} />} />
        <Route path={routes.buyNow.pattern} element={<BuyRoute />} />
      </Routes>
    </MemoryRouter>,
  );

function BuyRoute() {
  const { productId, offerId } = useParams();
  const [params] = useSearchParams();
  return <p>{`buying ${productId} ${offerId} yes=${params.get("yes")}`}</p>;
}

const fill = async () => {
  await userEvent.type(screen.getByLabelText("What"), wanted.what);
  await userEvent.type(screen.getByLabelText("How much"), wanted.quantity);
  await userEvent.type(screen.getByLabelText("Needed by"), wanted.neededBy);
};

describe("something not listed", () => {
  it("will not go on without saying what is wanted", async () => {
    show(client(), "/buy/wanted");
    expect(screen.getByRole("button", { name: "Ask shops" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Put up a notice" })).toBeDisabled();
  });

  it("will not take how much as words", async () => {
    show(client(), "/buy/wanted");
    await userEvent.type(screen.getByLabelText("What"), "Seed");
    await userEvent.type(screen.getByLabelText("How much"), "lots");
    expect(screen.getByText("Use a number.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask shops" })).toBeDisabled();
  });

  it("files what she wants and goes on to pick the shops", async () => {
    const c = client();
    show(c, "/buy/wanted");
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Ask shops" }));
    expect(c.createWanted).toHaveBeenCalledWith(wanted);
    expect(c.createNotice).not.toHaveBeenCalled();
    const sub = await screen.findByText("Hybrid maize seed 614 · 10 · by Friday");
    const title = screen.getByRole("heading", { level: 1, name: "Ask shops" });
    expect(title.nextElementSibling).toBe(sub);
    expect(screen.getByRole("banner")).not.toContainElement(title);
  });

  it("says so when what she wants could not be filed", async () => {
    const c = client({ createWanted: vi.fn().mockRejectedValue(new Error("x")) });
    show(c, "/buy/wanted");
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Ask shops" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That was not sent. Try again.");
  });

  it("shows every shop ticked to begin with", async () => {
    show(client(), `/buy/wanted/r1/ask?${query}`);
    for (const shop of shops) expect(await screen.findByRole("checkbox", { name: shop.name })).toBeChecked();
  });

  it("asks the ticked shops once each and never an unticked one", async () => {
    const c = client();
    show(c, `/buy/wanted/r1/ask?${query}`);
    await userEvent.click(await screen.findByRole("checkbox", { name: "Bondo Agrovet" }));
    await userEvent.click(screen.getByRole("button", { name: "Ask the ticked shops" }));
    await screen.findByText("Asked");
    const asked = (c.ask as any).mock.calls.map((call: any[]) => call[1]);
    expect(asked.sort()).toEqual(["p1", "p3"]);
    expect(c.ask).toHaveBeenCalledWith("r1", "p1", wanted);
  });

  it("will not ask with no shop ticked", async () => {
    const c = client();
    show(c, `/buy/wanted/r1/ask?${query}`);
    for (const shop of shops) await userEvent.click(await screen.findByRole("checkbox", { name: shop.name }));
    expect(screen.getByRole("button", { name: "Ask the ticked shops" })).toBeDisabled();
    expect(c.ask).not.toHaveBeenCalled();
  });

  it("stays on the shops and says so when no shop could be asked", async () => {
    const c = client({ ask: vi.fn().mockRejectedValue(new Error("x")) });
    show(c, `/buy/wanted/r1/ask?${query}`);
    await userEvent.click(await screen.findByRole("button", { name: "Ask the ticked shops" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The shops were not asked. Try again.");
    expect(screen.queryByText("Asked")).toBeNull();
  });

  it("goes on to who she asked when only some shops could not be asked", async () => {
    const ask = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue(undefined);
    show(client({ ask }), `/buy/wanted/r1/ask?${query}`);
    await userEvent.click(await screen.findByRole("button", { name: "Ask the ticked shops" }));
    expect(await screen.findByText("Asked")).toBeInTheDocument();
  });
});

describe("who she asked", () => {
  it("shows each shop with waiting, yes or no and the found rows", async () => {
    const c = client({
      listAsked: vi.fn().mockResolvedValue([
        { id: "a1", shopId: "p1", answer: "yes", offerId: "", question: "", detail: "" },
        { id: "a2", shopId: "p2", answer: "no", offerId: "", question: "", detail: "" },
        { id: "a3", shopId: "p3", answer: "waiting", offerId: "", question: "", detail: "" },
      ]),
      listFound: vi.fn().mockResolvedValue([
        { id: "y1", askId: "a1", shopId: "p1", offerId: "", what: "", quantity: "10", date: "2026-11-06", note: "KES 1,850" },
        { id: "y9", askId: "other", shopId: "p2", offerId: "", what: "", quantity: "", date: "", note: "not hers" },
      ]),
    });
    show(c, `/buy/wanted/r1?${query}`);
    expect(await screen.findByText("Found for you")).toBeInTheDocument();
    expect(screen.getByText("10 · by Friday · KES 1,850")).toBeInTheDocument();
    expect(screen.queryByText("not hers")).toBeNull();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(c.listAsked).toHaveBeenCalledWith("r1");
  });

  it("titles the screen with what she wants and draws how much and by when as its sub line under the bar", async () => {
    show(client(), `/buy/wanted/r1?${query}`);
    const title = await screen.findByRole("heading", { level: 1, name: "Hybrid maize seed 614" });
    expect(screen.getByRole("banner")).not.toContainElement(title);
    expect(title.nextElementSibling).toHaveTextContent("10 · by Friday");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("calls a shop the list does not hold Shop, never by its id", async () => {
    const c = client({
      listAsked: vi.fn().mockResolvedValue([{ id: "a1", shopId: "5d0c1b7e-0000-4000-8000-00000000abcd", answer: "yes", offerId: "", question: "", detail: "" }]),
      listFound: vi.fn().mockResolvedValue([{ id: "y1", askId: "a1", shopId: "5d0c1b7e-0000-4000-8000-00000000abcd", offerId: "", what: "", quantity: "", date: "", note: "" }]),
    });
    show(c, `/buy/wanted/r1?${query}`);
    await screen.findByText("Found for you");
    expect(screen.getAllByText("Shop")).toHaveLength(2);
    expect(screen.queryByText(/5d0c1b7e/)).toBeNull();
  });

  it("has no Buy now on a yes that names no offer", async () => {
    const c = client({
      listAsked: vi.fn().mockResolvedValue([{ id: "a1", shopId: "p1", answer: "yes", offerId: "", question: "", detail: "" }]),
      listFound: vi.fn().mockResolvedValue([{ id: "y1", askId: "a1", shopId: "p1", offerId: "", what: "", quantity: "", date: "", note: "" }]),
    });
    show(c, `/buy/wanted/r1?${query}`);
    await screen.findByText("Found for you");
    expect(screen.queryByRole("button", { name: "Buy now" })).toBeNull();
  });

  it("shows the price of the offer a yes answers and a Buy now that opens that offer", async () => {
    const c = client({
      listAsked: vi.fn().mockResolvedValue([{ id: "a1", shopId: "p1", answer: "yes", offerId: "o1", question: "", detail: "" }]),
      listFound: vi.fn().mockResolvedValue([{ id: "y1", askId: "a1", shopId: "p1", offerId: "", what: "", quantity: "", date: "2026-11-06", note: "" }]),
      listOffers: vi.fn().mockResolvedValue([{ id: "o1", product: "seed-614", words: "", price: 1850, unit: "10 kg bag" }]),
    });
    renderWithBuyRoute(c);
    expect(await screen.findByText("KES 1,850 a 10 kg bag · by Friday")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Buy now" }));
    expect(await screen.findByText("buying seed-614 o1 yes=y1")).toBeInTheDocument();
  });

  it("takes the offer from the yes itself when the yes names one", async () => {
    const c = client({
      listAsked: vi.fn().mockResolvedValue([{ id: "a1", shopId: "p1", answer: "yes", offerId: "", question: "", detail: "" }]),
      listFound: vi.fn().mockResolvedValue([{ id: "y1", askId: "a1", shopId: "p1", offerId: "o2", what: "", quantity: "", date: "", note: "" }]),
      listOffers: vi.fn().mockResolvedValue([{ id: "o2", product: "lime", words: "", price: 600, unit: "" }]),
    });
    renderWithBuyRoute(c);
    expect(await screen.findByText("KES 600")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy now" })).toBeInTheDocument();
  });

  it("still shows the found rows when the offers could not be read", async () => {
    const c = client({
      listAsked: vi.fn().mockResolvedValue([{ id: "a1", shopId: "p1", answer: "yes", offerId: "o1", question: "", detail: "" }]),
      listFound: vi.fn().mockResolvedValue([{ id: "y1", askId: "a1", shopId: "p1", offerId: "", what: "", quantity: "", date: "", note: "KES 900" }]),
      listOffers: vi.fn().mockRejectedValue(new Error("x")),
    });
    show(c, `/buy/wanted/r1?${query}`);
    expect(await screen.findByText("KES 900")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy now" })).toBeInTheDocument();
  });

  it("reads the request's words from the asks when the address carries none", async () => {
    const c = client({
      listAsked: vi.fn().mockResolvedValue([
        { id: "a1", shopId: "p1", answer: "waiting", offerId: "", question: "Hybrid maize seed 614", detail: "10 kg by 2026-11-06" },
      ]),
    });
    show(c, "/buy/wanted/r1");
    expect(await screen.findByRole("heading", { name: "Hybrid maize seed 614" })).toBeInTheDocument();
    expect(screen.getByText("10 kg · by Friday")).toBeInTheDocument();
  });

  it("prefers the words in the address over the asks", async () => {
    const c = client({
      listAsked: vi.fn().mockResolvedValue([{ id: "a1", shopId: "p1", answer: "waiting", offerId: "", question: "Other", detail: "" }]),
    });
    show(c, `/buy/wanted/r1?${query}`);
    expect(await screen.findByRole("heading", { name: "Hybrid maize seed 614" })).toBeInTheDocument();
  });

  it("leaves out Found for you while no shop has said yes", async () => {
    show(client({ listAsked: vi.fn().mockResolvedValue([{ id: "a3", shopId: "p3", answer: "waiting", offerId: "", question: "", detail: "" }]) }), `/buy/wanted/r1?${query}`);
    expect(await screen.findByText("Kisumu Agro Supplies")).toBeInTheDocument();
    expect(screen.queryByText("Found for you")).toBeNull();
  });

  it("says so when who she asked could not be loaded", async () => {
    show(client({ listAsked: vi.fn().mockRejectedValue(new Error("x")) }), `/buy/wanted/r1?${query}`);
    expect(await screen.findByRole("alert")).toHaveTextContent("The shops you asked could not be loaded.");
  });
});

describe("asking with the shop's matching offer", () => {
  const seed = { id: "o1", product: "seed-614", words: "Hybrid maize seed 614", price: 1850, unit: "10 kg bag" };
  const lime = { id: "o2", product: "lime", words: "Agricultural lime", price: 600, unit: "" };
  const stock = (byShop: Record<string, unknown[]>) => vi.fn().mockImplementation(async (shopId: string) => byShop[shopId] ?? []);

  it("sends the offer id of the ticked shop's offer that matches the words she typed", async () => {
    const c = client({ listOffers: stock({ p1: [lime, seed] }) });
    show(c, `/buy/wanted/r1/ask?${query}`);
    await userEvent.click(await screen.findByRole("button", { name: "Ask the ticked shops" }));
    await screen.findByText("Asked");
    expect(c.listOffers).toHaveBeenCalledWith("p1");
    expect(c.ask).toHaveBeenCalledWith("r1", "p1", wanted, "o1");
    expect(c.ask).toHaveBeenCalledWith("r1", "p2", wanted);
  });

  it("sends no offer when the shop's offers do not match, or could not be read", async () => {
    const c = client({
      listOffers: vi.fn().mockImplementation(async (shopId: string) => {
        if (shopId === "p3") throw new Error("x");
        return [lime];
      }),
    });
    show(c, `/buy/wanted/r1/ask?${query}`);
    await userEvent.click(await screen.findByRole("button", { name: "Ask the ticked shops" }));
    await screen.findByText("Asked");
    expect(c.ask).toHaveBeenCalledTimes(3);
    expect(c.ask).toHaveBeenCalledWith("r1", "p1", wanted);
    expect(c.ask).toHaveBeenCalledWith("r1", "p3", wanted);
  });

  it("does not read the offers of an unticked shop", async () => {
    const c = client({ listOffers: stock({ p1: [seed] }) });
    show(c, `/buy/wanted/r1/ask?${query}`);
    await userEvent.click(await screen.findByLabelText("Bondo Agrovet"));
    await userEvent.click(screen.getByRole("button", { name: "Ask the ticked shops" }));
    await screen.findByText("Asked");
    expect(c.listOffers).not.toHaveBeenCalledWith("p2");
  });
});

describe("the askTicked rule", () => {
  it("asks only ticked shops", async () => {
    const c = client();
    const result = await askTicked(c, "r1", wanted, shops, new Set(["p2"]));
    expect(result).toEqual({ asked: 1, failed: 0 });
    expect(c.ask).toHaveBeenCalledTimes(1);
    expect(c.ask).toHaveBeenCalledWith("r1", "p2", wanted);
  });

  it("asks a shop once however often it is listed in the ticks", async () => {
    const c = client();
    await askTicked(c, "r1", wanted, [shops[0], shops[0]], new Set(["p1"]));
    expect(c.ask).toHaveBeenCalledTimes(1);
  });
});

describe("a notice", () => {
  it("is put up from the same form without asking any shop", async () => {
    const c = client();
    show(c, "/buy/wanted");
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Put up a notice" }));
    expect(c.createNotice).toHaveBeenCalledWith(wanted);
    expect(c.createWanted).not.toHaveBeenCalled();
    expect(c.ask).not.toHaveBeenCalled();
    expect(await screen.findByText("Your notice")).toBeInTheDocument();
  });

  it("shows what was put up, seen by every shop, with a way to take it down", async () => {
    const c = client({ listNotices: vi.fn().mockResolvedValue([{ id: "n1", what: wanted.what, quantity: "10", neededBy: "2026-11-06", open: true }]) });
    show(c, "/buy/notices/n1");
    expect(await screen.findByText("Hybrid maize seed 614")).toBeInTheDocument();
    expect(screen.getByText("Friday, 6 Nov")).toBeInTheDocument();
    expect(screen.getByText("Every shop")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Take it down" })).toBeInTheDocument();
  });

  it("keeps the notice up and says so when taking it down fails", async () => {
    const c = client({
      listNotices: vi.fn().mockResolvedValue([{ id: "n1", what: wanted.what, quantity: "", neededBy: "", open: true }]),
      withdrawNotice: vi.fn().mockRejectedValue(new Error("x")),
    });
    show(c, "/buy/notices/n1");
    await userEvent.click(await screen.findByRole("button", { name: "Take it down" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The notice is still up. Try again.");
    expect(screen.getByRole("button", { name: "Take it down" })).toBeInTheDocument();
  });

  it("says so when the notice is not there", async () => {
    show(client(), "/buy/notices/zz");
    expect(await screen.findByRole("alert")).toHaveTextContent("The notice could not be found.");
  });
});

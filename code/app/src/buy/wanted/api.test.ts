import { callTool } from "../../wakala/mcp";
import { mcpWantedClient, wantedBody } from "./api";
import { dateWords, dayName } from "./dates";

vi.mock("../../wakala/mcp", () => ({ callTool: vi.fn() }));

const call = callTool as any;

const wanted = { what: " Hybrid maize seed 614 ", quantity: "10", neededBy: "2026-11-06" };

beforeEach(() => call.mockReset());

describe("the market tools she calls", () => {
  it("files what is wanted with the field names the market declares", async () => {
    call.mockResolvedValue({ id: "r1" });
    expect(await mcpWantedClient.createWanted(wanted)).toBe("r1");
    expect(call).toHaveBeenCalledWith("", "market_create_wanted", { wanted: "Hybrid maize seed 614", quantity: 10, needed_by: "2026-11-06" });
  });

  it("leaves out how much and by when when she gave neither", () => {
    expect(wantedBody({ what: "Lime", quantity: "", neededBy: "" })).toEqual({ wanted: "Lime" });
  });

  it("puts up a notice with the same body", async () => {
    call.mockResolvedValue({ id: "n1" });
    expect(await mcpWantedClient.createNotice(wanted)).toBe("n1");
    expect(call).toHaveBeenCalledWith("", "market_create_notice", wantedBody(wanted));
  });

  it("asks one named shop about one request", async () => {
    call.mockResolvedValue({});
    await mcpWantedClient.ask("r1", "p1", wanted);
    expect(call).toHaveBeenCalledWith("", "market_ask", {
      poster_id: "p1",
      request_id: "r1",
      question: "Hybrid maize seed 614",
      detail: "10 by 2026-11-06",
    });
    await mcpWantedClient.ask("r1", "p1", { what: "Lime", quantity: "", neededBy: "" });
    expect(call).toHaveBeenLastCalledWith("", "market_ask", { poster_id: "p1", request_id: "r1", question: "Lime", detail: "" });
  });

  it("lists only approved shops that are not away", async () => {
    call.mockResolvedValue({
      items: [
        { id: "p1", name: "Siaya Farm Stores", status: "approved", availability: "available" },
        { id: "p2", name: "Bondo Agrovet", status: "approved", availability: "away" },
        { id: "p3", name: "Kisumu Agro Supplies", status: "pending", availability: "available" },
      ],
    });
    expect(await mcpWantedClient.listShops()).toEqual([{ id: "p1", name: "Siaya Farm Stores" }]);
  });

  it("lists the asks of one request with silence as waiting", async () => {
    call.mockResolvedValue({
      items: [
        { id: "a1", poster_id: "p1", request_id: "r1", answer: "yes" },
        { id: "a2", poster_id: "p2", request_id: "r1", answer: "" },
        { id: "a3", poster_id: "p3", request_id: "other", answer: "no" },
      ],
    });
    expect(await mcpWantedClient.listAsked("r1")).toEqual([
      { id: "a1", shopId: "p1", answer: "yes", offerId: "", question: "", detail: "" },
      { id: "a2", shopId: "p2", answer: "waiting", offerId: "", question: "", detail: "" },
    ]);
  });

  it("reads the offer, the question and the detail an ask carries", async () => {
    call.mockResolvedValue({ items: [{ id: "a1", poster_id: "p1", request_id: "r1", offer_id: "o1", question: "Seed", detail: "10 by 2026-11-06" }] });
    expect(await mcpWantedClient.listAsked("r1")).toEqual([
      { id: "a1", shopId: "p1", answer: "waiting", offerId: "o1", question: "Seed", detail: "10 by 2026-11-06" },
    ]);
  });

  it("reads the offers with the market's field names", async () => {
    call.mockResolvedValue({ items: [{ id: "o1", product: "seed-614", product_words: "Hybrid maize seed 614", price: 1850, unit_words: "10 kg bag" }] });
    expect(await mcpWantedClient.listOffers()).toEqual([
      { id: "o1", product: "seed-614", words: "Hybrid maize seed 614", price: 1850, unit: "10 kg bag" },
    ]);
    expect(call).toHaveBeenCalledWith("", "market_list_offers", {});
  });

  it("lists one shop's offers by poster_id", async () => {
    call.mockResolvedValue({ items: [] });
    await mcpWantedClient.listOffers("p1");
    expect(call).toHaveBeenCalledWith("", "market_list_offers", { poster_id: "p1" });
  });

  it("sends offer_id in the ask only when one is given", async () => {
    call.mockResolvedValue({});
    await mcpWantedClient.ask("r1", "p1", wanted, "o1");
    expect(call).toHaveBeenCalledWith("", "market_ask", expect.objectContaining({ poster_id: "p1", offer_id: "o1" }));
    await mcpWantedClient.ask("r1", "p1", wanted);
    expect(call.mock.calls.at(-1)[2]).not.toHaveProperty("offer_id");
  });

  it("reads the yeses with the market's field names", async () => {
    call.mockResolvedValue({ items: [{ id: "y1", ask_id: "a1", poster_id: "p1", what: "Seed", quantity: 10, date: "2026-11-06", note: "ok" }] });
    expect(await mcpWantedClient.listFound()).toEqual([
      { id: "y1", askId: "a1", shopId: "p1", offerId: "", what: "Seed", quantity: "10", date: "2026-11-06", note: "ok" },
    ]);
  });

  it("reads notices and takes one down by its path name", async () => {
    call.mockResolvedValue({ items: [{ id: "n1", wanted: "Seed", quantity: 10, needed_by: "2026-11-06", state: "open" }] });
    expect(await mcpWantedClient.listNotices()).toEqual([{ id: "n1", what: "Seed", quantity: "10", neededBy: "2026-11-06", open: true }]);
    call.mockResolvedValue({});
    await mcpWantedClient.withdrawNotice("n1");
    expect(call).toHaveBeenLastCalledWith("", "market_withdraw_notice", { noticeID: "n1" });
  });
});

describe("dates in her words", () => {
  it("names the day and the date", () => {
    expect(dayName("2026-11-06")).toBe("Friday");
    expect(dateWords("2026-11-06")).toBe("Friday, 6 Nov");
  });

  it("hands back what it cannot read", () => {
    expect(dayName("soon")).toBe("soon");
    expect(dateWords("soon")).toBe("soon");
  });
});

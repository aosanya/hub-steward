import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetRuntimeConfig, setRuntimeConfig } from "../wakala/config";
import { callTool, resetMcp } from "../wakala/mcp";
import {
  askArguments,
  buyNowArguments,
  createOfferArguments,
  getStockArguments,
  listOffersArguments,
  setStockArguments,
  updateOfferArguments,
  type OfferFields,
} from "./arguments";
import { mcpMarketClient } from "./api";
import { mcpSupplyClient } from "../supply/api";

const exactKeys = (sent: Record<string, unknown>) => Object.keys(sent).sort();

const fullOffer: OfferFields = { posterId: "p1", words: "Urea 50kg", unit: "bag", price: 3800, bulkFrom: 10, bulkPrice: 3600, group: "urea" };
const bareOffer: OfferFields = { posterId: "p1", words: "Urea 50kg", unit: "bag", price: 3800, bulkFrom: 0, bulkPrice: 0 };

describe("getStockArguments", () => {
  it("sends the poster as posterID and nothing else", () => {
    const sent = getStockArguments("p1");
    expect(sent).toEqual({ posterID: "p1" });
  });
});

describe("setStockArguments", () => {
  it("sends the poster as poster_id with the product and the count", () => {
    const sent = setStockArguments("p1", "DAP fertiliser", 35);
    expect(sent).toEqual({ poster_id: "p1", product: "DAP fertiliser", count: 35 });
  });
});

describe("listOffersArguments", () => {
  it("sends poster_id for one poster", () => {
    const sent = listOffersArguments("p1");
    expect(sent).toEqual({ poster_id: "p1" });
  });

  it("sends nothing for every poster, whether the poster is left out or empty", () => {
    expect(listOffersArguments()).toEqual({});
    expect(listOffersArguments("")).toEqual({});
  });
});

describe("createOfferArguments", () => {
  it("sends the offer's own fields with the group as product", () => {
    const sent = createOfferArguments(fullOffer);
    expect(exactKeys(sent)).toEqual(["bulk_min", "bulk_price", "poster_id", "price", "product", "product_words", "unit_words"]);
    expect(sent).toMatchObject({ poster_id: "p1", product_words: "Urea 50kg", product: "urea", unit_words: "bag", price: 3800, bulk_min: 10, bulk_price: 3600 });
  });

  it("leaves out product when the offer has no group", () => {
    const sent = createOfferArguments(bareOffer);
    expect(exactKeys(sent)).toEqual(["bulk_min", "bulk_price", "poster_id", "price", "product_words", "unit_words"]);
  });
});

describe("updateOfferArguments", () => {
  it("sends the offer as offerID beside the body and never as id", () => {
    const sent = updateOfferArguments("o1", fullOffer);
    expect(exactKeys(sent)).toEqual(["bulk_min", "bulk_price", "offerID", "poster_id", "price", "product", "product_words", "unit_words"]);
    expect(sent.offerID).toBe("o1");
    expect(sent).not.toHaveProperty("id");
  });

  it("leaves out product when the offer has no group", () => {
    const sent = updateOfferArguments("o1", bareOffer);
    expect(exactKeys(sent)).toEqual(["bulk_min", "bulk_price", "offerID", "poster_id", "price", "product_words", "unit_words"]);
  });
});

describe("buyNowArguments", () => {
  it("sends the offer and the quantity, with no yes_id when there is no yes", () => {
    const sent = buyNowArguments("o1", 2);
    expect(sent).toEqual({ offerID: "o1", quantity: 2 });
    expect(buyNowArguments("o1", 2, "")).toEqual({ offerID: "o1", quantity: 2 });
  });

  it("adds yes_id when the order comes from a yes", () => {
    const sent = buyNowArguments("o1", 40, "y1");
    expect(sent).toEqual({ offerID: "o1", quantity: 40, yes_id: "y1" });
  });
});

describe("askArguments", () => {
  it("sends a request's question to one poster", () => {
    const sent = askArguments({ posterId: "p1", requestId: "r1", question: "Lime", detail: "10 by 2026-11-06" });
    expect(exactKeys(sent)).toEqual(["detail", "poster_id", "question", "request_id"]);
    expect(sent).toMatchObject({ poster_id: "p1", request_id: "r1", question: "Lime", detail: "10 by 2026-11-06" });
  });

  it("keeps an empty detail and adds the offer the question is about", () => {
    const sent = askArguments({ posterId: "p1", requestId: "r1", question: "Lime", detail: "", offerId: "o1" });
    expect(exactKeys(sent)).toEqual(["detail", "offer_id", "poster_id", "question", "request_id"]);
    expect(sent.detail).toBe("");
  });

  it("sends a sale's kind and product and no detail", () => {
    const sent = askArguments({ posterId: "b1", requestId: "r1", question: "40 bags of maize", offerId: "o1", kind: "sale", product: "maize" });
    expect(exactKeys(sent)).toEqual(["kind", "offer_id", "poster_id", "product", "question", "request_id"]);
  });

  it("leaves out every optional field it is not given", () => {
    const sent = askArguments({ posterId: "p1", requestId: "r1", question: "Lime", offerId: "", kind: "", product: "" });
    expect(exactKeys(sent)).toEqual(["poster_id", "question", "request_id"]);
  });
});

describe("one read of the offers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    forgetRuntimeConfig();
    resetMcp();
  });

  const stubWakala = () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      const text = body.includes('"initialize"')
        ? '{"jsonrpc":"2.0","id":1,"result":{}}'
        : '{"jsonrpc":"2.0","id":2,"result":{"structuredContent":{"items":[{"id":"o1","product":"maize","poster_id":"p1"}]}}}';
      return { ok: true, status: 200, headers: new Headers({ "Mcp-Session-Id": "s1" }), text: async () => text };
    });
    vi.stubGlobal("fetch", fetcher);
    return fetcher;
  };

  const offerReads = (fetcher: ReturnType<typeof vi.fn>) =>
    fetcher.mock.calls.filter(([, init]) => String(init?.body ?? "").includes('"name":"market_list_offers"')).length;

  it("is shared by the supplier's product list and the buyer's market", async () => {
    setRuntimeConfig({ mcp: "https://api.example/mcp" });
    resetMcp();
    const fetcher = stubWakala();
    await mcpSupplyClient.listProducts!();
    await mcpMarketClient.listProducts();
    await callTool("", "market_list_offers", listOffersArguments());
    expect(offerReads(fetcher)).toBe(1);
  });
});

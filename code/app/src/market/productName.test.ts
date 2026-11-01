import { posterOffersOf, productName, productNameAt } from "./productName";

const offer = (product: string, words: string, price: string) => ({ product, words, price });

describe("productName", () => {
  it("reads the words of the cheapest offer for the product", () => {
    const offers = [offer("urea", "Urea 50kg bag", "3900"), offer("urea", "Urea 50kg", "3800"), offer("maize", "Dry maize", "4200")];
    expect(productName("urea", offers)).toBe("Urea 50kg");
  });

  it("skips an offer with no words", () => {
    expect(productName("urea", [offer("urea", "", "3000"), offer("urea", "Urea 50kg", "3800")])).toBe("Urea 50kg");
  });

  it("gives the product as the data holds it when no offer has words", () => {
    expect(productName("urea", [])).toBe("urea");
    expect(productName("urea", [offer("urea", "", "3800")])).toBe("urea");
  });
});

describe("offers read with their shop", () => {
  const reply = {
    items: [
      { poster_id: "p2", product: "urea", product_words: "UREA 46%", price: 3000 },
      { poster_id: "p1", product: "urea", product_words: "Urea 50kg", price: 3800 },
      { poster_id: "p1", product: "dap", product_words: "", price: 4500 },
    ],
  };

  it("keeps the shop, the key, the words and the price of each offer", () => {
    expect(posterOffersOf(reply)[1]).toEqual({ poster: "p1", product: "urea", words: "Urea 50kg", price: "3800" });
  });

  it("reads no offers from a reply that holds none", () => {
    expect(posterOffersOf(undefined)).toEqual([]);
    expect(posterOffersOf({ items: "no" })).toEqual([]);
  });

  it("names a product by the words of its own shop's cheapest offer, not another shop's", () => {
    expect(productNameAt("urea", "p1", posterOffersOf(reply))).toBe("Urea 50kg");
    expect(productNameAt("urea", "p2", posterOffersOf(reply))).toBe("UREA 46%");
  });

  it("gives the key when the shop has no words for it, and nothing when there is no key", () => {
    expect(productNameAt("dap", "p1", posterOffersOf(reply))).toBe("dap");
    expect(productNameAt("", "p1", posterOffersOf(reply))).toBe("");
  });
});

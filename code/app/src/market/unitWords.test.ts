import { priceWords, quantityLabel, quantityWords, unitWordsOf } from "./unitWords";

describe("quantityWords", () => {
  it("reads the offer's own unit word and makes it plural from two", () => {
    expect(quantityWords(20, "litre")).toBe("20 litres");
    expect(quantityWords(2, "bag")).toBe("2 bags");
    expect(quantityWords(0, "crate")).toBe("0 crates");
  });

  it("keeps the unit word as written for one", () => {
    expect(quantityWords(1, "litre")).toBe("1 litre");
  });

  it("gives the number alone when the offer names no unit", () => {
    expect(quantityWords(20, "")).toBe("20");
    expect(quantityWords(20, "  ")).toBe("20");
  });
});

describe("unitWordsOf", () => {
  it("is the unit word for the count and empty without one", () => {
    expect(unitWordsOf("litre", 20)).toBe("litres");
    expect(unitWordsOf("litre", 1)).toBe("litre");
    expect(unitWordsOf("", 20)).toBe("");
  });
});

describe("priceWords", () => {
  it("prices a litre offer a litre", () => {
    expect(priceWords(85, "litre")).toBe("KES 85 a litre");
  });

  it("prices an offer with no unit as the price alone", () => {
    expect(priceWords(85, "")).toBe("KES 85");
  });
});

describe("quantityLabel", () => {
  it("names the field after the plural unit, or the quantity without one", () => {
    expect(quantityLabel("litre")).toBe("Litres");
    expect(quantityLabel("")).toBe("Quantity");
  });
});

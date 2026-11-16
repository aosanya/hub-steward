import type { Offer } from "./api";
import { bestOffer } from "./matchOffer";

const offer = (id: string, words: string): Offer => ({ id, product: "", words, price: 100, unit: "" });

describe("the offer that matches the words she typed", () => {
  it("matches whole words without regard to case", () => {
    expect(bestOffer("HYBRID maize seed 614", [offer("o1", "hybrid Maize Seed 614")])?.id).toBe("o1");
  });

  it("lets a plural s on either side match", () => {
    expect(bestOffer("maize seeds", [offer("o1", "Maize seed")])?.id).toBe("o1");
    expect(bestOffer("maize seed", [offer("o1", "Maize seeds")])?.id).toBe("o1");
  });

  it("does not match part of a word", () => {
    expect(bestOffer("seed", [offer("o1", "seedling trays")])).toBeUndefined();
    expect(bestOffer("lime", [offer("o1", "sublime")])).toBeUndefined();
  });

  it("matches when what she typed is a part of the offer's words, or the offer's words a part of hers", () => {
    expect(bestOffer("maize seed", [offer("o1", "Hybrid maize seed 614")])?.id).toBe("o1");
    expect(bestOffer("hybrid maize seed 614 certified", [offer("o1", "Hybrid maize seed 614")])?.id).toBe("o1");
  });

  it("takes the closest of several matches, the first on a tie", () => {
    const offers = [offer("o1", "Hybrid maize seed 614 bulk"), offer("o2", "Hybrid maize seed 614"), offer("o3", "Hybrid maize seed 614")];
    expect(bestOffer("hybrid maize seed 614", offers)?.id).toBe("o2");
  });

  it("finds nothing when no word is shared, or nothing was typed", () => {
    expect(bestOffer("urea", [offer("o1", "Agricultural lime")])).toBeUndefined();
    expect(bestOffer("   ", [offer("o1", "Agricultural lime")])).toBeUndefined();
    expect(bestOffer("lime", [offer("o1", "")])).toBeUndefined();
  });
});

import type { Offer } from "./api";

const wordsOf = (typed: string) =>
  new Set(
    (typed.toLowerCase().match(/[a-z0-9]+/g) ?? []).map((word) =>
      word.length > 2 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word,
    ),
  );

const shared = (left: Set<string>, right: Set<string>) => [...left].filter((word) => right.has(word)).length;

const score = (typed: Set<string>, offer: Offer) => {
  const named = wordsOf(offer.words);
  const both = shared(typed, named);
  const covered = both === typed.size || both === named.size;
  return named.size > 0 && typed.size > 0 && covered ? both * 100 - Math.abs(named.size - typed.size) : 0;
};

export const bestOffer = (typed: string, offers: Offer[]) => {
  const wanted = wordsOf(typed);
  const ranked = offers
    .map((offer) => ({ offer, score: score(wanted, offer) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.offer;
};

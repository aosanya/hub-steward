export type NamedOffer = { product: string; words: string; price: string };

const priceOf = (offer: NamedOffer) => Number(offer.price) || Infinity;

export const productName = (product: string, offers: NamedOffer[]): string => {
  const named = offers
    .filter((offer) => offer.product === product && offer.words !== "")
    .sort((a, b) => priceOf(a) - priceOf(b));
  return named[0]?.words ?? product;
};

export type PosterOffer = NamedOffer & { poster: string };

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

export const posterOffersOf = (reply: any): PosterOffer[] =>
  (Array.isArray(reply?.items) ? reply.items : []).map((raw: any) => ({
    poster: text(raw?.poster_id),
    product: text(raw?.product),
    words: text(raw?.product_words),
    price: text(raw?.price),
  }));

export const productNameAt = (product: string, posterId: string, offers: PosterOffer[]): string =>
  product === "" ? "" : productName(product, offers.filter((offer) => offer.poster === posterId));

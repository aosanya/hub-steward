export type OfferFields = {
  posterId: string;
  words: string;
  unit: string;
  price: number;
  bulkFrom: number;
  bulkPrice: number;
  group?: string;
};

export type AskFields = {
  posterId: string;
  requestId: string;
  question: string;
  offerId?: string;
  detail?: string;
  kind?: string;
  product?: string;
};

export const listOffersArguments = (posterId?: string) => (posterId ? { poster_id: posterId } : {});

export const createOfferArguments = (offer: OfferFields) => ({
  poster_id: offer.posterId,
  product_words: offer.words,
  ...(offer.group ? { product: offer.group } : {}),
  unit_words: offer.unit,
  price: offer.price,
  bulk_min: offer.bulkFrom,
  bulk_price: offer.bulkPrice,
});

export const updateOfferArguments = (offerId: string, offer: OfferFields) => ({
  offerID: offerId,
  ...createOfferArguments(offer),
});

export const getStockArguments = (posterId: string) => ({ posterID: posterId });

export const setStockArguments = (posterId: string, product: string, count: number) => ({
  poster_id: posterId,
  product,
  count,
});

export const buyNowArguments = (offerId: string, quantity: number, yesId?: string) => ({
  offerID: offerId,
  quantity,
  ...(yesId ? { yes_id: yesId } : {}),
});

export const askArguments = (ask: AskFields) => ({
  poster_id: ask.posterId,
  request_id: ask.requestId,
  question: ask.question,
  ...(ask.offerId ? { offer_id: ask.offerId } : {}),
  ...(ask.detail !== undefined ? { detail: ask.detail } : {}),
  ...(ask.kind ? { kind: ask.kind } : {}),
  ...(ask.product ? { product: ask.product } : {}),
});

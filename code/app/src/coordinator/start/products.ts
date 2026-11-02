import { posterOffersOf, productName, type PosterOffer } from "../../market/productName";
import { callTool } from "../../wakala/mcp";

export type OfferedProduct = { key: string; words: string };

export type ProductsClient = { offers: (posterId: string) => Promise<PosterOffer[]> };

export const mcpProductsClient: ProductsClient = {
  async offers(posterId) {
    const reply = await callTool("", "market_list_offers", { poster_id: posterId });
    return posterOffersOf(reply).filter((offer) => offer.poster === posterId);
  },
};

export const offeredProducts = (offers: PosterOffer[]): OfferedProduct[] =>
  [...new Set(offers.map((offer) => offer.product).filter((key) => key !== ""))].map((key) => ({
    key,
    words: productName(key, offers),
  }));

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const resolveProduct = (typed: string, offered: OfferedProduct[]): OfferedProduct | undefined =>
  offered.find((product) => same(product.key, typed)) ?? offered.find((product) => same(product.words, typed));

export const noOfferWords = (offered: OfferedProduct[]) =>
  `No shop offer matches that product. Offered: ${offered.map((product) => product.words).join(", ")}.`;

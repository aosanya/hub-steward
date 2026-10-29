import type { Product } from "../../market/api";
import { priceWords } from "../../market/unitWords";
import {
  bulkWords,
  groupSaleLine,
  mcpSellClient,
  nameOfProduct,
  type BuyerPrice,
  type GroupSale,
  type SellClient,
} from "../../sell/now/api";
import type { Block, CardSpec } from "../blocks/types";
import type { AgentSource } from "./source";

export const sellNowPrompt = "Sell now";
export const joinGroupPrompt = "Join a group sale";

const agentSays = (text: string): Block => ({ kind: "text", from: "agent", text });

const produceFor = (products: Product[]): Block => ({ kind: "prompts", prompts: products.map((product) => product.name) });

const actions = (hasGroup: boolean): Block => ({
  kind: "prompts",
  prompts: hasGroup ? [sellNowPrompt, joinGroupPrompt] : [sellNowPrompt],
});

const failed = agentSays("The buyers' prices could not be loaded. Try again in a moment.");

const buyerOf = (offer: BuyerPrice) => offer.buyer || "A buyer";

export const priceCard = (offer: BuyerPrice, group?: GroupSale): CardSpec => ({
  id: `price-${offer.id}`,
  title: buyerOf(offer),
  lines: [offer.words, priceWords(offer.price, offer.unit), bulkWords(offer), group ? groupSaleLine(group) : ""].filter((line) => line !== ""),
  buttons: [
    { label: sellNowPrompt, to: `/sell/${offer.product}/now/${offer.id}` },
    ...(group ? [{ label: "Sell together", to: `/sell/group/${group.id}` }] : []),
  ],
});

export const groupCard = (group: GroupSale, buyer: string, product: string): CardSpec => ({
  id: `group-${group.id}`,
  title: `${product} group sale`,
  lines: [groupSaleLine(group), buyer].filter((line) => line !== ""),
  buttons: [{ label: "Join the group sale", to: `/sell/group/${group.id}` }],
});

const priceCards = (cards: CardSpec[]): Block => ({ kind: "cards", cards, shown: 1, more: "Show other buyers" });

const groupCards = (cards: CardSpec[]): Block => ({ kind: "cards", cards, shown: 1, more: "Show other group sales" });

const buyerFor = (prices: BuyerPrice[], group: GroupSale) => prices.find((offer) => offer.buyerId === group.buyerId)?.buyer ?? "";

const groupOf = (groups: GroupSale[], offer: BuyerPrice) => groups.find((group) => group.buyerId === offer.buyerId);

const load = async (client: SellClient, product: string) => {
  const [prices, groups] = await Promise.all([client.listPrices(product), client.listGroupSales(product)]);
  return { prices, groups };
};

const pricesFor = async (client: SellClient, product: string, products: Product[]): Promise<Block[]> => {
  try {
    const { prices, groups } = await load(client, product);
    if (prices.length === 0) return [agentSays(`No buyer has posted a price for ${product} yet.`), produceFor(products)];
    const best = buyerOf(prices[0]);
    const groupNote = groups.length > 0 ? " A group sale is also open." : "";
    return [
      agentSays(`${best} pays the most for ${nameOfProduct(product, prices)}.${groupNote}`),
      priceCards(prices.map((offer) => priceCard(offer, groupOf(groups, offer)))),
      actions(groups.length > 0),
    ];
  } catch {
    return [failed];
  }
};

const sellNowFor = async (client: SellClient, product: string, products: Product[]): Promise<Block[]> => {
  try {
    const { prices } = await load(client, product);
    if (prices.length === 0) return [agentSays(`No buyer has posted a price for ${product} yet.`), produceFor(products)];
    const cards = prices.map((offer) => {
      const card = priceCard(offer);
      return { ...card, buttons: card.buttons.slice(0, 1) };
    });
    return [agentSays("Pick the buyer to sell to. The best price is first."), priceCards(cards)];
  } catch {
    return [failed];
  }
};

const groupsFor = async (client: SellClient, product: string): Promise<Block[]> => {
  try {
    const { prices, groups } = await load(client, product);
    const name = nameOfProduct(product, prices);
    if (groups.length === 0) return [agentSays(`No group sale is open for ${name}.`), actions(false)];
    return [
      agentSays(`These group sales for ${name} are open.`),
      groupCards(groups.map((group) => groupCard(group, buyerFor(prices, group), name))),
    ];
  } catch {
    return [failed];
  }
};

const actionPrompts = [sellNowPrompt, joinGroupPrompt].map((prompt) => prompt.toLowerCase());

const sameWords = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const productIdOf = (said: string, products: Product[]): string =>
  (products.find((product) => sameWords(product.name, said)) ?? products.find((product) => sameWords(product.id, said)))?.id ??
  said.trim().toLowerCase();

const productIn = (thread: Block[], products: Product[]): string => {
  const said = thread
    .filter((block) => block.kind === "text" && block.from === "me")
    .map((block) => (block.kind === "text" ? block.text.trim().toLowerCase() : ""))
    .filter((text) => text !== "" && !actionPrompts.includes(text));
  return said.length > 0 ? productIdOf(said[said.length - 1], products) : (products[0]?.id ?? "");
};

const listed = (client: SellClient): Promise<Product[] | null> => client.listProducts().catch(() => null);

export const sellSource = (client: SellClient = mcpSellClient): AgentSource => ({
  async opening() {
    const greeting = agentSays("What do you want to sell?");
    const products = await listed(client);
    if (products === null) return [greeting, failed];
    if (products.length === 0) return [greeting, agentSays("No buyer has posted a price yet.")];
    const first = await pricesFor(client, products[0].id, products);
    const cards = first.filter((block) => block.kind === "cards");
    const explanation = first.filter((block) => block.kind === "text");
    return [greeting, produceFor(products), ...(cards.length > 0 ? cards : explanation)];
  },
  async reply(text, thread) {
    const said = text.trim();
    const products = (await listed(client)) ?? [];
    if (said === sellNowPrompt) return sellNowFor(client, productIn(thread, products), products);
    if (said === joinGroupPrompt) return groupsFor(client, productIn(thread, products));
    return pricesFor(client, productIdOf(said, products), products);
  },
  async submit() {
    return [agentSays("There is nothing to fill in here."), produceFor((await listed(client)) ?? [])];
  },
});

export const sellHarvestSource = sellSource();

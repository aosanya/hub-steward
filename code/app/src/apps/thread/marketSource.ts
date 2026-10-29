import { routes } from "../../routes";
import { mcpMarketClient, type MarketClient, type Product } from "../../market/api";
import type { Block, CardSpec } from "../blocks/types";
import type { AgentSource } from "./source";

export const onSale = "What is on sale";
export const notListed = "Something not listed";
export const myOrders = "My orders";

const agentSays = (text: string): Block => ({ kind: "text", from: "agent", text });

const prompts: Block = { kind: "prompts", prompts: [onSale, notListed, myOrders] };

const shopCount = (shops: number) => `${shops} ${shops === 1 ? "shop sells" : "shops sell"} it`;

export const productCard = (product: Product): CardSpec => ({
  id: product.id,
  title: product.name,
  lines: [shopCount(product.shops), `From ${product.fromPrice} a bag`],
  buttons: [{ label: "See the shops", to: routes.product.path({ productId: product.id }) }],
});

const productCards = (products: Product[]): Block => ({
  kind: "cards",
  cards: products.map(productCard),
  shown: 2,
  more: "Show more products",
});

const wantedCards = (): Block => ({
  kind: "cards",
  cards: [
    {
      id: "wanted",
      title: "Ask the shops",
      lines: ["Say what you need and the shops answer."],
      buttons: [{ label: "Ask for it", to: "/buy/wanted" }],
    },
  ],
  shown: 1,
});

const ordersCards = (): Block => ({
  kind: "cards",
  cards: [
    {
      id: "orders",
      title: "My orders",
      lines: ["What you bought and where it stands."],
      buttons: [{ label: "Open my orders", to: "/my-orders" }],
    },
  ],
  shown: 1,
});

const saleBlocks = async (client: MarketClient): Promise<Block[]> => {
  try {
    const products = await client.listProducts();
    if (products.length === 0) return [agentSays("Nothing is on sale yet."), prompts];
    return [agentSays("This is what is on sale."), productCards(products)];
  } catch {
    return [agentSays("The products could not be loaded. Try again in a moment.")];
  }
};

const named = async (client: MarketClient, text: string): Promise<Product[]> => {
  const wanted = text.toLowerCase();
  const products = await client.listProducts();
  return products.filter((product) => wanted.includes(product.name.toLowerCase()) || wanted.includes(product.id.toLowerCase()));
};

export const marketSource = (client: MarketClient = mcpMarketClient): AgentSource => ({
  async opening() {
    const sale = await saleBlocks(client);
    const cards = sale.filter((block) => block.kind === "cards");
    return [agentSays("What do you want to buy?"), prompts, ...cards];
  },
  async reply(text) {
    const said = text.trim();
    if (said === onSale) return saleBlocks(client);
    if (said === notListed) return [agentSays("Tell the shops what you are looking for."), wantedCards()];
    if (said === myOrders) return [agentSays("Here are your orders."), ordersCards()];
    try {
      const found = await named(client, said);
      if (found.length > 0) return [agentSays("These match what you wrote."), productCards(found)];
    } catch {
      return [agentSays("The products could not be loaded. Try again in a moment.")];
    }
    return [agentSays("I could not find that on sale. You can ask the shops for it."), wantedCards(), prompts];
  },
  async submit() {
    return [agentSays("There is nothing to fill in here."), prompts];
  },
});

export const buyInputsSource = marketSource();

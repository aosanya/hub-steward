import { screen } from "../../app/screen";

export const marketPaths = {
  start: screen("/start/:stepId"),
  market: screen("/market"),
  product: screen("/market/:productId"),
  buyNow: screen("/market/:productId/buy/:offerId"),
  marketOrder: screen("/market/orders/:orderId"),
  boughtOrder: screen("/market/bought/:orderId"),
  groupOrder: screen("/market/:productId/group-orders/:groupOrderId"),
  joinGroupOrder: screen("/market/:productId/group-orders/:groupOrderId/join"),
};

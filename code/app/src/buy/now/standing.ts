import { canCancelOrder, orderOf } from "../orders/api";
import { quantityWords } from "../../market/unitWords";
import type { BuyOrder, OrderStatus } from "./api";

const myOrderOf = (order: BuyOrder) =>
  orderOf({
    id: order.id,
    poster_id: order.posterId,
    product: order.product,
    quantity: order.quantity,
    unit_price: order.unitPrice,
    state: order.state,
    promised_date: order.promisedDate,
    paid: order.paid,
  });

export const orderStatus = (order: BuyOrder) => myOrderOf(order).standing as OrderStatus;

export const canCancel = (order: BuyOrder) => canCancelOrder(myOrderOf(order));

export const agentLine = (order: BuyOrder) => {
  const shop = order.shop || "the shop";
  return orderStatus(order) === "Cancelled" ? `Telling ${shop} that you cancelled.` : `Asking ${shop} about ${quantityWords(order.quantity, order.unit)}.`;
};

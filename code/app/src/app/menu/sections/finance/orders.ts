import { homeEmpty, listOf, text, type Item } from "../staff/staffData";

export { homeEmpty, listOf, text, type Item };

export const amountOf = (order: Item) => Number(order.quantity ?? 0) * Number(order.unit_price ?? 0);

export const orderRow = (order: Item, paid: boolean) => ({
  id: text(order, "id"),
  payer: text(order, "picker_name"),
  line: [text(order, "product"), String(amountOf(order))].filter((part) => part !== "").join(" · "),
  paid,
});

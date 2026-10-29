import { callTool } from "../../wakala/mcp";
import { dayWords } from "../../ui/days";
import { kes } from "../api";

export type SupplyYes = {
  id: string;
  askId: string;
  supplierId: string;
  picker: string;
  what: string;
  quantity: number;
  date: string;
  note: string;
  state: string;
};

export type SupplyOrder = {
  id: string;
  picker: string;
  yesId: string;
  promisedDate: string;
  supplierId: string;
  product: string;
  quantity: number;
  unitPrice: number;
  state: string;
  paid: boolean;
  createdAt: string;
};

export type OrdersClient = {
  listYeses: () => Promise<SupplyYes[]>;
  listOrders: () => Promise<SupplyOrder[]>;
  getOrder: (orderId: string) => Promise<SupplyOrder>;
  markPaid: (orderId: string) => Promise<SupplyOrder>;
};

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);
const itemsOf = (reply: any): any[] => (Array.isArray(reply?.items) ? reply.items : []);

export const yesOf = (raw: any): SupplyYes => ({
  id: text(raw?.id),
  askId: text(raw?.ask_id),
  supplierId: text(raw?.poster_id),
  picker: text(raw?.picker_name) || text(raw?.picker),
  what: text(raw?.what),
  quantity: count(raw?.quantity),
  date: text(raw?.date),
  note: text(raw?.note),
  state: text(raw?.state),
});

export const orderOf = (raw: any): SupplyOrder => ({
  id: text(raw?.id),
  picker: text(raw?.picker_name) || text(raw?.picker),
  yesId: text(raw?.yes_id),
  promisedDate: text(raw?.promised_date),
  supplierId: text(raw?.poster_id),
  product: text(raw?.product),
  quantity: count(raw?.quantity),
  unitPrice: count(raw?.unit_price),
  state: text(raw?.state),
  paid: raw?.paid === true,
  createdAt: text(raw?.created_at),
});

export const mcpOrdersClient: OrdersClient = {
  async listYeses() {
    return itemsOf(await callTool("", "market_list_yeses", {})).map(yesOf);
  },
  async listOrders() {
    return itemsOf(await callTool("", "market_list_orders", {})).map(orderOf);
  },
  async getOrder(orderId) {
    return orderOf(await callTool("", "market_get_order", { orderID: orderId }));
  },
  async markPaid(orderId) {
    return orderOf(await callTool("", "market_mark_paid", { orderID: orderId }));
  },
};

export const orderTotal = (o: SupplyOrder) => o.quantity * o.unitPrice;

export { dayWords };

export const orderMeta = (o: SupplyOrder) => `${o.quantity} of ${o.product} · ${dayWords(o.createdAt)}`;

export const yesMeta = (y: SupplyYes) => `${y.quantity} of ${y.what}${y.date ? ` · ${dayWords(y.date)}` : ""}`;

export const priceLine = (o: SupplyOrder) => `${kes(o.unitPrice)} each · ${kes(orderTotal(o))} in all`;

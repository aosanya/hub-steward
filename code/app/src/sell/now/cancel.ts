import { callTool } from "../../wakala/mcp";
import { readSale, statusOf, type Sale } from "./api";

export const cancelSaleTool = "market_cancel_order";
export const withdrawSaleTool = "market_withdraw_ask";

export type SaleActions = {
  cancelSale: (sale: Sale) => Promise<Sale>;
};

export const canCancelSale = (sale: Sale) => {
  const status = statusOf(sale);
  return status === "Waiting" || status === "Yes";
};

export const mcpSaleActions: SaleActions = {
  async cancelSale(sale) {
    if (sale.orderId === "") await callTool("", withdrawSaleTool, { askID: sale.id });
    else await callTool("", cancelSaleTool, { orderID: sale.orderId });
    return readSale(sale.id);
  },
};

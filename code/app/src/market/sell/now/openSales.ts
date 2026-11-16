import { readSales, statusOf, type Sale } from "./api";

export type OpenSalesClient = {
  listOpenSales: (productId: string) => Promise<Sale[]>;
};

export const mcpOpenSales: OpenSalesClient = {
  async listOpenSales(productId) {
    return (await readSales()).filter((sale) => sale.product === productId && statusOf(sale) !== "Cancelled");
  },
};

import { callTool } from "../wakala/mcp";

export const groupOrdersPageSize = 200;

export type GroupOrderFilter = { mine?: boolean; state?: string };

const idOf = (raw: any): string => (raw?.id == null ? "" : String(raw.id));

const pageArguments = (filter: GroupOrderFilter, after: string) => ({
  limit: groupOrdersPageSize,
  ...(filter.mine ? { mine: true } : {}),
  ...(filter.state ? { state: filter.state } : {}),
  ...(after === "" ? {} : { after }),
});

export const listAllGroupOrders = async (filter: GroupOrderFilter = {}): Promise<any[]> => {
  const orders: any[] = [];
  let after = "";
  for (;;) {
    const reply = await callTool("", "market_list_group_orders", pageArguments(filter, after));
    const rows: any[] = Array.isArray(reply?.items) ? reply.items : [];
    const last = idOf(rows[rows.length - 1]);
    if (last !== "" && last === after) return orders;
    orders.push(...rows);
    if (rows.length < groupOrdersPageSize || last === "") return orders;
    after = last;
  }
};

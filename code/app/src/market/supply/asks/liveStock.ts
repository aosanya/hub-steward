import { mcpStockReader } from "../stock/api";
import type { StockReader } from "./stock";

export const liveStock: StockReader = (ask) => mcpStockReader()(ask);

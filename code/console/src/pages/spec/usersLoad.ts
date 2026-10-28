import { pageModule } from "../../data/registry";
import type { Query } from "../../data/types";
import type { PageRow } from "../../types";

export async function rowsOf(page: string, hubId: string, query: Query = {}): Promise<PageRow[]> {
  const module = pageModule(page);
  if (!module) throw new Error("no module for the page " + page);
  return module.rows(hubId, query);
}

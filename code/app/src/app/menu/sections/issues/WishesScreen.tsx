import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { IssueListScreen } from "./IssueListScreen";

type Item = Record<string, unknown>;

export const wishesTool = "forms_catalog_board_item_list";

const count = (item: Item, key: string) => {
  const value = item[key];
  return typeof value === "number" ? value : 0;
};

const wishes = async () => itemsOf(await callTool("", wishesTool, {})) as Item[];

const countLines = (item: Item) => [`raised by ${count(item, "raised_by")}`, `${count(item, "me_too")} said Me too`];

export function WishesScreen() {
  return <IssueListScreen title="Wishes" tool={wishesTool} fields={{ title: "title", meta: "" }} empty="No wishes yet." load={wishes} lines={countLines} />;
}

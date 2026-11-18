import { useWord } from "../../../../features/agency/useWord";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuWindow } from "../../MenuWindow";
import { homeEmpty, moneyWords, text, tools, unitOf, type Item } from "./financeData";

const totalsArguments = { key: "neighbourhood", account_type: "expense" };

const totalsOf = async () => {
  const reply = (await callTool("", tools.dimensionTotals, totalsArguments)) as { totals?: unknown } | null;
  return Array.isArray(reply?.totals) ? (reply.totals as Item[]) : [];
};

const rowOf = (total: Item, unit: string) => ({
  id: text(total, "value"),
  name: text(total, "value"),
  meta: `Spent ${moneyWords(total.total as number, unit)}`,
  spent: moneyWords(total.total as number, unit),
  entries: String(total.entries ?? 0),
});

export function NeighbourhoodSpendingScreen() {
  const word = useWord("accounting");
  const unit = unitOf(word);
  const title = word("Spending by Neighbourhood");
  const load = async () => (await totalsOf()).map((total) => rowOf(total, unit));
  const loadOne = async (id: string) => (await load()).find((row) => row.id === id) ?? { id };
  return (
    <MenuWindow
      title={title}
      detailKey={unit}
      listKey={unit}
      list={{ title, tool: tools.dimensionTotals, load, fields: { title: "name", meta: "meta" }, empty: homeEmpty("No spending by neighbourhood yet.") }}
      detail={{ tool: tools.dimensionTotals, load: loadOne, fields: { Neighbourhood: "name", Spent: "spent", Entries: "entries" }, status: "status" }}
    />
  );
}

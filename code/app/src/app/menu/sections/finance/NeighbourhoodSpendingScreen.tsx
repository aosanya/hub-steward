import { useWord } from "../../../../features/agency/useWord";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuWindow } from "../../MenuWindow";
import { NeighbourhoodPage } from "./NeighbourhoodPage";
import { financePaths } from "./paths";
import { homeEmpty, moneyWords, text, tools, unitOf, type Item } from "./financeData";

const totalsArguments = { key: "neighbourhood", account_type: "expense" };

const withoutWords = "No neighbourhood";

const totalsOf = async () => {
  const reply = (await callTool("", tools.dimensionTotals, totalsArguments)) as { totals?: unknown; without?: Item } | null;
  const named = Array.isArray(reply?.totals) ? (reply.totals as Item[]) : [];
  const without = reply?.without;
  return without && Number(without.entries) > 0 ? [...named, { ...without, value: withoutWords }] : named;
};

const rowOf = (total: Item, unit: string) => ({
  named: total.value === withoutWords ? "" : "yes",
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
      withTabs
      bandless
      detailKey={unit}
      listKey={unit}
      list={{ title, tool: tools.dimensionTotals, load, fields: { title: "name", meta: "meta" }, empty: homeEmpty("No spending by neighbourhood yet.") }}
      detail={{ tool: tools.dimensionTotals, load: loadOne, fields: {}, status: "", extra: (row) => <NeighbourhoodPage row={row} back={financePaths.spendingByNeighbourhood.path()} unit={unit} /> }}
    />
  );
}

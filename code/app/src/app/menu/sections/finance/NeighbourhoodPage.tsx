import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { ChatAboutFinance, FactsCard, FinanceHead } from "./FinanceRecord";
import { dayWords, moneyWords, text, tools, type Item } from "./financeData";

const facts: [string, string][] = [
  ["Spent", "spent"],
  ["Entries", "entries"],
];

const entriesWords = (entries: string) => `${entries} ${entries === "1" ? "entry" : "entries"}`;

const entriesOf = async (value: string) => {
  const reply = (await callTool("", tools.dimensionEntries, { key: "neighbourhood", value, account_type: "expense" })) as { entries?: unknown } | null;
  return Array.isArray(reply?.entries) ? (reply.entries as Item[]) : [];
};

const shareWords = (entry: Item, unit: string) =>
  typeof entry.share_percent === "number" && typeof entry.whole === "number" ? `${entry.share_percent}% of ${moneyWords(entry.whole, unit)} · ` : "";

function EntriesCard({ value, unit }: { value: string; unit: string }) {
  const entries = useLoad(() => entriesOf(value), `neighbourhood-entries:${openAgencyId()}:${value}`);
  if (entries.state !== "ready" || entries.data.length === 0) return null;
  const rows = entries.data.map((entry) => (
    <ListRow key={text(entry, "id")} title={text(entry, "narration") || text(entry, "account")} meta={`${dayWords(text(entry, "occurred_at"))} · ${shareWords(entry, unit)}${moneyWords(entry.amount as number, unit)}`} />
  ));
  return <Section word="Entries" icon="wallet" all rows={rows} />;
}

type Props = { row: Item; back: string; unit?: string };

export function NeighbourhoodPage({ row, back, unit = "" }: Props) {
  const name = text(row, "name");
  const quiet = [`Spent ${text(row, "spent")}`, entriesWords(text(row, "entries"))].join(" · ");
  return (
    <div className="person-page">
      <ChatAboutFinance about={{ kind: "neighbourhood", id: text(row, "id"), name }} back={back} />
      <FinanceHead name={name} line={quiet} />
      <div className="sections">
        <FactsCard word="Spending" item={row} facts={facts} />
        {text(row, "named") === "yes" ? <EntriesCard value={text(row, "id")} unit={unit} /> : null}
      </div>
    </div>
  );
}

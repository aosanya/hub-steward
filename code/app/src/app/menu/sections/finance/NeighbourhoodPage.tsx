import { ChatAboutFinance, FactsCard, FinanceHead } from "./FinanceRecord";
import { text, type Item } from "./financeData";

const facts: [string, string][] = [
  ["Spent", "spent"],
  ["Entries", "entries"],
];

const entriesWords = (entries: string) => `${entries} ${entries === "1" ? "entry" : "entries"}`;

type Props = { row: Item; back: string };

export function NeighbourhoodPage({ row, back }: Props) {
  const name = text(row, "name");
  const quiet = [`Spent ${text(row, "spent")}`, entriesWords(text(row, "entries"))].join(" · ");
  return (
    <div className="person-page">
      <ChatAboutFinance about={{ kind: "neighbourhood", id: text(row, "id"), name }} back={back} />
      <FinanceHead name={name} line={quiet} />
      <div className="sections">
        <FactsCard word="Spending" item={row} facts={facts} />
      </div>
    </div>
  );
}

import { Chip } from "../../../../shared/ui/Chip";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuWindow } from "../../MenuWindow";
import { dayWords, homeEmpty, listOf, quoteRow, tenderRow, text, tools, type Item } from "./financeData";

const loadTenders = async () => (await listOf(tools.tenderList)).map(tenderRow);

const quotesLine = (quotes: Item[]) =>
  quotes
    .map(quoteRow)
    .map((quote) => `${quote.supplier} ${quote.meta}`)
    .join(", ");

const loadTender = async (id: string) => {
  const [reply, quotes] = await Promise.all([
    callTool("", tools.tenderRead, { tenderID: id }) as Promise<Item | null>,
    listOf(tools.quoteList, { tenderID: id }),
  ]);
  const tender = ((reply?.item as Item | undefined) ?? reply ?? {}) as Item;
  const row = tenderRow({ ...tender, quote_count: quotes.length });
  const closes = text(tender, "closes_at");
  return {
    id,
    title: row.title,
    closes: closes ? dayWords(closes) : "",
    status: row.status,
    quotes: quotesLine(quotes),
  };
};

export function TendersScreen() {
  return (
    <MenuWindow
      title="Procurement"
      list={{
        title: "Procurement",
        tool: tools.tenderList,
        load: loadTenders,
        fields: { title: "title", meta: "meta" },
        empty: homeEmpty("No tenders yet."),
        end: (tender) => <Chip>{text(tender, "status")}</Chip>,
      }}
      detail={{
        tool: tools.tenderRead,
        load: loadTender,
        fields: { Tender: "title", Closes: "closes", Quotes: "quotes" },
        status: "status",
      }}
    />
  );
}

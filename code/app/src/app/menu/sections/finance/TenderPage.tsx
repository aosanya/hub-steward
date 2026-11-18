import { useState } from "react";
import { Button } from "../../../../shared/ui/Button";
import { Chip } from "../../../../shared/ui/Chip";
import { Field } from "../../../../shared/ui/Field";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { callTool } from "../../../../shared/wakala/mcp";
import { actionFailedWords } from "../../MenuDetail";
import { MenuEditForm, type EditField } from "../../MenuEditForm";
import { ActButton, ChatAboutFinance, EditAct, FactsCard, FinanceHead, useFinanceEdit } from "./FinanceRecord";
import { dayWords, listOf, moneyWords, quoteRow, text, tools, type Item } from "./financeData";

export const manageCode = "accounting.manage";

const lowestWords = "Lowest";

const tenderFields: EditField[] = [
  { label: "Title", key: "title", required: true },
  { label: "Description", key: "description" },
  { label: "Closing day", key: "closes_at", kind: "date" },
];

const quoteFields: EditField[] = [
  { label: "Supplier", key: "supplier", required: true },
  { label: "Amount", key: "amount", kind: "number", required: true },
  { label: "Note", key: "note" },
  { label: "Valid until", key: "valid_until", kind: "date" },
];

const facts: [string, string][] = [
  ["Description", "description"],
  ["Budget line", "budgetLine"],
  ["Closes", "closes"],
];

const instantOf = (day: string) => (day ? `${day}T00:00:00Z` : undefined);

const withoutBlanks = (fields: Record<string, unknown>) => Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== ""));

const quoteMeta = (quote: Item, unit: string) =>
  [moneyWords(text(quote, "amount"), unit), text(quote, "valid_until") ? `valid until ${dayWords(text(quote, "valid_until"))}` : "", text(quote, "note")].filter(Boolean).join(" · ");

const readQuote = async (tenderID: string, quote: Item) => (await listOf(tools.quoteList, { tenderID })).find((found) => text(found, "id") === text(quote, "id")) ?? quote;

function AddQuoteForm({ tenderID, onAdded }: { tenderID: string; onAdded: () => void }) {
  const [failed, setFailed] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const save = async () => {
    try {
      await callTool("", tools.quoteCreate, { tenderID, supplier: supplier.trim(), amount: Number(amount), ...withoutBlanks({ note: note.trim(), valid_until: instantOf(validUntil) }) });
      onAdded();
    } catch {
      setFailed(true);
    }
  };
  return (
    <>
      <Field label="Supplier" value={supplier} onChange={(event) => setSupplier(event.target.value)} />
      <Field label="Amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} />
      <Field label="Note" value={note} onChange={(event) => setNote(event.target.value)} />
      <Field label="Valid until" type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
      <Button kind="primary" disabled={supplier.trim() === "" || !(Number(amount) > 0)} onClick={save}>Save quote</Button>
      {failed ? <LoadFailed words={actionFailedWords} /> : null}
    </>
  );
}

type Props = { tender: Item; unit: string; back: string; reload: () => Promise<Item>; onSaved: () => void };

export function TenderPage({ tender, unit, back, reload, onSaved }: Props) {
  const edit = useFinanceEdit();
  const [adding, setAdding] = useState(false);
  const id = text(tender, "id");
  const quotes = Array.isArray(tender.quotes) ? (tender.quotes as Item[]) : [];
  const lowest = Math.min(...quotes.map((quote) => Number(quote.amount)));
  const closes = text(tender, "closes");
  const line = [text(tender, "status"), closes ? `Closes ${closes}` : ""].filter(Boolean).join(" · ");
  const rows = quotes.map((quote) => (
    <div key={text(quote, "id")}>
      <ListRow
        title={quoteRow(quote).supplier}
        meta={quoteMeta(quote, unit)}
        end={quotes.length > 1 && Number(quote.amount) === lowest ? <Chip tone="success">{lowestWords}</Chip> : undefined}
      />
      <MenuEditForm
        item={quote}
        id={text(quote, "id")}
        idArg="quoteID"
        tool={tools.quoteUpdate}
        permission={manageCode}
        fields={quoteFields}
        keep={["supplier", "amount", "note", "valid_until"]}
        readAgain={() => readQuote(id, quote)}
        onSaved={onSaved}
      />
    </div>
  ));
  return (
    <div className="person-page">
      <ChatAboutFinance about={{ kind: "tender", id, name: text(tender, "title") }} back={`${back}?tender=${id}`} />
      <FinanceHead name={text(tender, "title")} line={line} />
      <div className="sections">
        {edit.editing ? (
          <MenuEditForm
            item={tender}
            id={id}
            idArg="tenderID"
            tool={tools.tenderUpdate}
            permission={manageCode}
            fields={tenderFields}
            keep={["title", "description", "closes_at"]}
            readAgain={reload}
            bare
            openCount={1}
            onSaved={() => {
              edit.stop();
              onSaved();
            }}
            onCancel={edit.stop}
          />
        ) : (
          <FactsCard word="Tender" item={tender} facts={facts} foot={<EditAct permission={manageCode} onEdit={edit.start} />} />
        )}
        <Section
          word="Quotes"
          plain
          rows={rows}
          empty={{ words: "No quotes yet." }}
          foot={adding ? null : <ActButton permission={manageCode} label="Add quote" onAct={() => setAdding(true)} />}
        />
        {adding ? <AddQuoteForm tenderID={id} onAdded={onSaved} /> : null}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useWord, type Wording } from "../../../../features/agency/useWord";
import { Button } from "../../../../shared/ui/Button";
import { Chip } from "../../../../shared/ui/Chip";
import { Field } from "../../../../shared/ui/Field";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { SearchSelect } from "../../../../shared/ui/SearchSelect";
import { TextArea } from "../../../../shared/ui/TextArea";
import { callTool } from "../../../../shared/wakala/mcp";
import { actionFailedWords } from "../../MenuDetail";
import { MenuEditForm, type EditField } from "../../MenuEditForm";
import { MenuWindow } from "../../MenuWindow";
import { dayWords, homeEmpty, listOf, moneyWords, quoteRow, tenderRow, text, tools, type Item } from "./financeData";

const manageCode = "accounting.manage";

const rolesTool = "agency_get_my_roles";

const lowestWords = "Lowest";

const heldBy = (reply: unknown) => {
  const permissions = (reply as { permissions?: unknown } | null)?.permissions;
  return Array.isArray(permissions) && permissions.includes(manageCode);
};

const useCanManage = () => {
  const [can, setCan] = useState(false);
  useEffect(() => {
    let live = true;
    callTool("", rolesTool, {}).then(
      (reply) => live && setCan(heldBy(reply)),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  return can;
};

const instantOf = (day: string) => (day ? `${day}T00:00:00Z` : undefined);

const withoutBlanks = (fields: Record<string, unknown>) => Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== ""));

const quoteMeta = (quote: Item) =>
  [moneyWords(text(quote, "amount")), text(quote, "valid_until") ? `valid until ${dayWords(text(quote, "valid_until"))}` : "", text(quote, "note")].filter(Boolean).join(" · ");

const loadTender = async (id: string) => {
  const [reply, quotes] = await Promise.all([
    callTool("", tools.tenderRead, { tenderID: id }) as Promise<Item | null>,
    listOf(tools.quoteList, { tenderID: id }),
  ]);
  const tender = ((reply?.item as Item | undefined) ?? reply ?? {}) as Item;
  const budgetID = text(tender, "budget_id");
  const line = budgetID ? ((await callTool("", tools.budgetRead, { budgetID }).catch(() => null)) as Item | null) : null;
  const row = tenderRow({ ...tender, quote_count: quotes.length });
  const closes = text(tender, "closes_at");
  return {
    id,
    title: row.title,
    description: text(tender, "description"),
    budgetLine: text(line ?? {}, "name"),
    closes: closes ? dayWords(closes) : "",
    closes_at: closes,
    status: row.status,
    quotes,
  };
};

const tenderFields: EditField[] = [
  { label: "Title", key: "title", required: true },
  { label: "Description", key: "description" },
];

const quoteFields: EditField[] = [
  { label: "Supplier", key: "supplier", required: true },
  { label: "Amount", key: "amount", kind: "number", required: true },
  { label: "Note", key: "note" },
];

const readQuote = async (tenderID: string, quote: Item) =>
  (await listOf(tools.quoteList, { tenderID })).find((found) => text(found, "id") === text(quote, "id")) ?? quote;

function QuoteRows({ quotes, tenderID, onEdited }: { quotes: Item[]; tenderID: string; onEdited: () => void }) {
  const lowest = Math.min(...quotes.map((quote) => Number(quote.amount)));
  return (
    <>
      {quotes.map((quote) => (
        <div key={text(quote, "id")}>
          <Rows>
            <ListRow
              title={quoteRow(quote).supplier}
              meta={quoteMeta(quote)}
              end={quotes.length > 1 && Number(quote.amount) === lowest ? <Chip tone="success">{lowestWords}</Chip> : undefined}
            />
          </Rows>
          <MenuEditForm
            item={quote}
            id={text(quote, "id")}
            idArg="quoteID"
            tool={tools.quoteUpdate}
            permission={manageCode}
            fields={quoteFields}
            keep={["supplier", "amount", "note", "valid_until"]}
            readAgain={() => readQuote(tenderID, quote)}
            onSaved={onEdited}
          />
        </div>
      ))}
    </>
  );
}

function AddQuote({ tenderID, onAdded }: { tenderID: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
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
  if (!open) return <Button kind="primary" onClick={() => setOpen(true)}>Add quote</Button>;
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

function OpenTender({ onOpened, onCancel, word }: { onOpened: () => void; onCancel: () => void; word: Wording }) {
  const [lines, setLines] = useState<{ value: string; label: string }[]>([]);
  const [budgetID, setBudgetID] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [closes, setCloses] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    listOf(tools.budgetList).then(
      (items) => setLines(items.map((line) => ({ value: text(line, "id"), label: text(line, "name") }))),
      () => undefined,
    );
  }, []);
  const save = async () => {
    try {
      await callTool("", tools.tenderCreate, { budget_id: budgetID, title: title.trim(), ...withoutBlanks({ description: description.trim(), closes_at: instantOf(closes) }) });
      onOpened();
    } catch {
      setFailed(true);
    }
  };
  return (
    <>
      <SearchSelect label="Budget line" choices={lines} value={budgetID} onChange={setBudgetID} />
      <Field label="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
      <TextArea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
      <Field label="Closes on" type="date" value={closes} onChange={(event) => setCloses(event.target.value)} />
      <Button kind="primary" disabled={budgetID === "" || title.trim() === ""} onClick={save}>Save {word("Tender").toLowerCase()}</Button>
      <Button onClick={onCancel}>Cancel</Button>
      {failed ? <LoadFailed words={actionFailedWords} /> : null}
    </>
  );
}

export function TendersScreen() {
  const word = useWord("accounting");
  const can = useCanManage();
  const [version, setVersion] = useState(0);
  const [opening, setOpening] = useState(false);
  const [listed, setListed] = useState(-1);
  const refresh = () => setVersion((was) => was + 1);
  const loadTenders = async () => {
    const rows = (await listOf(tools.tenderList)).map(tenderRow);
    setListed(rows.length);
    return rows;
  };
  const openButton = <Button kind="primary" onClick={() => setOpening(true)}>Open {word("Tender").toLowerCase()}</Button>;
  const form = (
    <OpenTender
      onOpened={() => {
        setOpening(false);
        refresh();
      }}
      onCancel={() => setOpening(false)}
      word={word}
    />
  );
  return (
    <MenuWindow
      title={word("Procurement")}
      listKey={version}
      detailKey={version}
      above={opening ? form : can && listed > 0 ? openButton : null}
      list={{
        title: word("Procurement"),
        tool: tools.tenderList,
        load: loadTenders,
        fields: { title: "title", meta: "meta" },
        empty: { ...homeEmpty(`No ${word("Tenders").toLowerCase()} yet.`), children: can && !opening ? openButton : null },
        end: (tender) => <Chip>{text(tender, "status")}</Chip>,
      }}
      detail={{
        tool: tools.tenderRead,
        load: loadTender,
        fields: { Tender: "title", Description: "description", "Budget line": "budgetLine", Closes: "closes" },
        status: "status",
        extra: (tender) => (
          <>
            <MenuEditForm
              item={tender}
              id={text(tender, "id")}
              idArg="tenderID"
              tool={tools.tenderUpdate}
              permission={manageCode}
              fields={tenderFields}
              keep={["title", "description", "closes_at"]}
              readAgain={() => loadTender(text(tender, "id"))}
              onSaved={refresh}
            />
            {Array.isArray(tender.quotes) && tender.quotes.length > 0 ? <QuoteRows quotes={tender.quotes as Item[]} tenderID={text(tender, "id")} onEdited={refresh} /> : null}
            {can ? <AddQuote tenderID={text(tender, "id")} onAdded={refresh} /> : null}
          </>
        ),
      }}
    />
  );
}

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWord, type Wording } from "../../../../features/agency/useWord";
import { Button } from "../../../../shared/ui/Button";
import { Chip } from "../../../../shared/ui/Chip";
import { Field } from "../../../../shared/ui/Field";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { ReferencePicker } from "../../../../shared/ui/ReferencePicker";
import { TextArea } from "../../../../shared/ui/TextArea";
import { callTool } from "../../../../shared/wakala/mcp";
import { actionFailedWords } from "../../MenuDetail";
import { MenuWindow } from "../../MenuWindow";
import { dayWords, homeEmpty, instantOf, listOf, tenderRow, text, tools, unitOf, withoutBlanks, type Item } from "./financeData";
import { financePaths } from "./paths";
import { manageCode, TenderPage } from "./TenderPage";

const rolesTool = "agency_get_my_roles";

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
    budget_id: budgetID,
    title: row.title,
    description: text(tender, "description"),
    budgetLine: text(line ?? {}, "name"),
    closes: closes ? dayWords(closes) : "",
    closes_at: closes,
    status: row.status,
    quotes,
  };
};

function OpenTender({ onOpened, onCancel, word }: { onOpened: () => void; onCancel: () => void; word: Wording }) {
  const [lines, setLines] = useState<{ value: string; label: string }[] | null>(null);
  const [linesFailed, setLinesFailed] = useState(false);
  const [budgetID, setBudgetID] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [closes, setCloses] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    listOf(tools.budgetList).then(
      (items) => setLines(items.map((line) => ({ value: text(line, "id"), label: text(line, "name") }))),
      () => setLinesFailed(true),
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
      <ReferencePicker label="Budget line" status={linesFailed ? "error" : lines === null ? "loading" : undefined} choices={lines ?? []} value={budgetID} onChange={setBudgetID} />
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
  const unit = unitOf(word);
  const [search] = useSearchParams();
  const can = useCanManage();
  const [version, setVersion] = useState(0);
  const [opening, setOpening] = useState(false);
  const [listed, setListed] = useState(-1);
  const refresh = () => setVersion((was) => was + 1);
  const loadTenders = async () => {
    const rows = (await listOf(tools.tenderList)).map((tender) => tenderRow(tender, unit));
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
      withTabs
      bandless
      startAt={search.get("tender") ?? undefined}
      listKey={`${version}${unit}`}
      detailKey={`${version}${unit}`}
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
        fields: {},
        status: "",
        extra: (tender) => <TenderPage tender={tender} unit={unit} back={financePaths.procurement.path()} reload={() => loadTender(text(tender, "id"))} onSaved={refresh} />,
      }}
    />
  );
}

import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { useWord } from "../../../../features/agency/useWord";
import { Button } from "../../../../shared/ui/Button";
import { Card } from "../../../../shared/ui/Card";
import { Field } from "../../../../shared/ui/Field";
import { Segmented } from "../../../../shared/ui/Segmented";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuDetail } from "../../MenuDetail";
import { refusalWords } from "../../MenuEditForm";
import { MenuWindow } from "../../MenuWindow";
import { dayStart, dayWords, homeEmpty, listOf, moneyWords, periodEndOf, periodWords, reportPeriodOf, text, tools, unitOf, type Item } from "./financeData";
import { figureOf, noReportWords, periodRefusal } from "./reportPeriod";

const manageRole = "accounting.manage";

const kinds = [
  { id: "budget_and_actuals", label: "Budget and actuals" },
  { id: "spending_by_department", label: "Spending by department" },
];

const kindWords = (kind: string) => kinds.find((one) => one.id === kind)?.label ?? kind;

const recordPeriod = (record: Item) => periodWords(text(record, "period_start"), text(record, "period_end"));

const sentRow = (record: Item) => ({
  id: text(record, "id"),
  kind: kindWords(text(record, "kind")),
  meta: `${recordPeriod(record)} · Sent ${dayWords(text(record, "sent_at"))}`,
});

const recordView = (record: Item, unit: string) => ({
  id: text(record, "id"),
  kind: kindWords(text(record, "kind")),
  period: recordPeriod(record),
  planned: moneyWords(text(record, "planned"), unit),
  spent: moneyWords(text(record, "spent"), unit),
  difference: moneyWords(text(record, "difference"), unit),
  sent: dayWords(text(record, "sent_at")),
});

const recordFields = { Kind: "kind", Period: "period", Planned: "planned", Spent: "spent", Difference: "difference", Sent: "sent" };

const loadSent = async () => (await listOf(tools.upwardReportList)).map(sentRow);

const loadRecord = async (id: string, unit: string) => {
  const found = (await listOf(tools.upwardReportList)).find((record) => text(record, "id") === id);
  return found ? recordView(found, unit) : { id };
};

const loadFigures = async (id: string, unit: string) => {
  try {
    const report = (await callTool("", tools.reportRead, reportPeriodOf(id))) as Item | null;
    return {
      id,
      planned: moneyWords(figureOf(report, "planned") as number, unit),
      spent: moneyWords(figureOf(report, "spent") as number, unit),
      difference: moneyWords(figureOf(report, "difference") as number, unit),
    };
  } catch {
    return { id, note: noReportWords };
  }
};

const figureFields = { Planned: "planned", Spent: "spent", Difference: "difference", Note: "note" };

const recordOf = (reply: unknown) => ((reply as { item?: Item } | null)?.item ?? reply) as Item;

function ReportForm({ onSent, unit }: { onSent: () => void; unit: string }) {
  const manage = useMay(manageRole);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [kind, setKind] = useState(kinds[0].id);
  const [refusal, setRefusal] = useState("");
  const [reading, setReading] = useState("");
  const [record, setRecord] = useState<Item | null>(null);
  const [sending, setSending] = useState(false);
  const show = () => {
    const words = periodRefusal(start, end);
    setRefusal(words);
    setRecord(null);
    setReading(words ? "" : `${dayStart(start)}~${periodEndOf(end)}`);
  };
  const send = async () => {
    const words = periodRefusal(start, end);
    setRefusal(words);
    setReading("");
    if (words) return;
    setSending(true);
    try {
      setRecord(recordOf(await callTool("", tools.upwardReportSend, { period_start: dayStart(start), period_end: periodEndOf(end), kind })));
      onSent();
    } catch (error) {
      setRecord(null);
      setRefusal(refusalWords(error));
    }
    setSending(false);
  };
  return (
    <section aria-label="Report to send">
      <Card title="Report to send">
        <Field label="From" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        <Field label="To" type="date" value={end} onChange={(event) => setEnd(event.target.value)} error={refusal || undefined} />
        <Segmented label="Kind of report" items={kinds} current={kind} onChange={setKind} />
        <Button onClick={show}>Show figures</Button>
        {manage ? <Button kind="primary" disabled={sending} onClick={send}>Send report</Button> : null}
        {reading ? <MenuDetail key={`${reading}${unit}`} bare id={reading} title="National Report" tool={tools.reportRead} load={(id: string) => loadFigures(id, unit)} fields={figureFields} status="" /> : null}
        {record ? <MenuDetail key={`${text(record, "id")}${unit}`} bare id={text(record, "id")} title="National Report" tool={tools.upwardReportSend} load={async () => recordView(record, unit)} fields={recordFields} status="" /> : null}
      </Card>
    </section>
  );
}

export function UpwardReportScreen() {
  const unit = unitOf(useWord("accounting"));
  const [sent, setSent] = useState(0);
  return (
    <MenuWindow
      title="National Report"
      listKey={sent}
      detailKey={unit}
      above={<ReportForm onSent={() => setSent((was) => was + 1)} unit={unit} />}
      list={{
        title: "Sent reports",
        tool: tools.upwardReportList,
        load: loadSent,
        fields: { title: "kind", meta: "meta" },
        empty: homeEmpty("Nothing has been sent yet."),
        groups: (rows) => [{ heading: "Sent reports", items: rows }],
      }}
      detail={{ tool: tools.upwardReportList, load: (id: string) => loadRecord(id, unit), fields: recordFields, status: "" }}
    />
  );
}

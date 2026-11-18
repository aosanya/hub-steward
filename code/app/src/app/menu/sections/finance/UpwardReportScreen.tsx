import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { useWord } from "../../../../features/agency/useWord";
import { ActionsMenu } from "../../../../shared/ui/ActionsMenu";
import { Field } from "../../../../shared/ui/Field";
import { Section } from "../../../../shared/ui/Section";
import { Segmented } from "../../../../shared/ui/Segmented";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuDetail } from "../../MenuDetail";
import { refusalWords } from "../../MenuEditForm";
import { PageFrame } from "../../PageFrame";
import { useBackToSection } from "../../useBackToSection";
import { Shell } from "../../../Shell";
import { ListRow } from "../../../../shared/ui/ListRow";
import { useLoad } from "../../../../features/forms/useLoad";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { dayStart, dayWords, listOf, moneyWords, periodEndOf, periodWords, reportPeriodOf, text, tools, unitOf, type Item } from "./financeData";
import { ChatAboutFinance, FactsCard } from "./FinanceRecord";
import { financePaths } from "./paths";
import { figureOf, noReportWords, periodRefusal } from "./reportPeriod";

const manageRole = "accounting.manage";

const kinds = [
  { id: "budget_and_actuals", label: "Budget and actuals" },
  { id: "spending_by_department", label: "Spending by department" },
];

const kindWords = (kind: string) => kinds.find((one) => one.id === kind)?.label ?? kind;

const recordPeriod = (record: Item) => periodWords(text(record, "period_start"), text(record, "period_end"));

const sentMeta = (record: Item) => `${recordPeriod(record)} · Sent ${dayWords(text(record, "sent_at"))}`;

const recordView = (record: Item, unit: string) => ({
  id: text(record, "id"),
  kind: kindWords(text(record, "kind")),
  period: recordPeriod(record),
  planned: moneyWords(text(record, "planned"), unit),
  spent: moneyWords(text(record, "spent"), unit),
  difference: moneyWords(text(record, "difference"), unit),
  sent: dayWords(text(record, "sent_at")),
});

const periodWordsOf = (id: string) => {
  const { period_start, period_end } = reportPeriodOf(id);
  return periodWords(period_start, period_end);
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

const figureFacts: [string, string][] = [["Planned", "planned"], ["Spent", "spent"], ["Difference", "difference"], ["Note", "note"]];

const recordFacts: [string, string][] = [["Kind", "kind"], ["Period", "period"], ["Planned", "planned"], ["Spent", "spent"], ["Difference", "difference"], ["Sent", "sent"]];

const recordOf = (reply: unknown) => ((reply as { item?: Item } | null)?.item ?? reply) as Item;

function useReportForm(onSent: () => void) {
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
  const chatId = reading || (record ? `${text(record, "period_start")}~${text(record, "period_end")}` : "");
  return { manage, start, setStart, end, setEnd, kind, setKind, refusal, reading, record, sending, show, send, chatId };
}

type ReportFormState = ReturnType<typeof useReportForm>;

function ReportForm({ form, unit }: { form: ReportFormState; unit: string }) {
  const { start, setStart, end, setEnd, kind, setKind, refusal, reading, record, show, chatId } = form;
  return (
    <>
      <Section
        word="Report to send"
        plain
        rows={[
          <Field key="from" label="From" type="date" value={start} onChange={(event) => setStart(event.target.value)} />,
          <Field key="to" label="To" type="date" value={end} onChange={(event) => setEnd(event.target.value)} error={refusal || undefined} />,
          <Segmented key="kind" label="Kind of report" items={kinds} current={kind} onChange={setKind} />,
        ]}
        foot={
          <>
            <button type="button" className="sec-foot-item" onClick={show}>Show figures</button>
          </>
        }
      />
      {chatId ? <ChatAboutFinance about={{ kind: "report", id: chatId, name: periodWordsOf(chatId) }} back={financePaths.nationalReport.path()} /> : null}
      {reading ? <MenuDetail key={`${reading}${unit}`} bare id={reading} title="National Report" tool={tools.reportRead} load={(id: string) => loadFigures(id, unit)} fields={{}} status="" extra={(figures) => <FactsCard word="Report" item={figures} facts={figureFacts} />} /> : null}
      {record ? <MenuDetail key={`${text(record, "id")}${unit}`} bare id={text(record, "id")} title="National Report" tool={tools.upwardReportSend} load={async () => recordView(record, unit)} fields={{}} status="" extra={(sent) => <FactsCard word="Sent report" item={sent} facts={recordFacts} />} /> : null}
    </>
  );
}

const quietLine = (records: Item[]) => (records.length === 0 ? "Nothing has been sent yet" : `Last sent ${dayWords(text(records[0], "sent_at"))}`);

function SentCard({ records, unit }: { records: Item[]; unit: string }) {
  const [chosen, setChosen] = useState("");
  const open = records.find((record) => text(record, "id") === chosen);
  return (
    <>
      <Section
        word="Sent reports"
        plain
        empty={{ words: "Nothing has been sent yet." }}
        rows={records.map((record) => (
          <ListRow key={text(record, "id")} title={kindWords(text(record, "kind"))} meta={sentMeta(record)} onClick={() => setChosen(text(record, "id"))} pressed={text(record, "id") === chosen} />
        ))}
      />
      {open ? <FactsCard word="Sent report" item={recordView(open, unit)} facts={recordFacts} /> : null}
    </>
  );
}

export function UpwardReportScreen() {
  const unit = unitOf(useWord("accounting"));
  const [sent, setSent] = useState(0);
  const back = useBackToSection();
  const form = useReportForm(() => setSent((was) => was + 1));
  const records = useLoad(() => listOf(tools.upwardReportList), `sent-reports:${openAgencyId()}:${sent}`);
  const list = records.state === "ready" ? records.data : [];
  return (
    <Shell title="National Report" onBack={back.onBack} backLabel={back.backLabel}>
      <PageFrame
        title="National Report"
        line={quietLine(list)}
        actions={<ActionsMenu align="start" actions={form.manage ? [{ label: "Send to national level", onSelect: () => (form.sending ? undefined : void form.send()) }] : []} />}
      >
        <ReportForm form={form} unit={unit} />
        <SentCard records={list} unit={unit} />
      </PageFrame>
    </Shell>
  );
}

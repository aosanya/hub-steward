import { useState } from "react";
import { useWord } from "../../../../features/agency/useWord";
import { Field } from "../../../../shared/ui/Field";
import { Section } from "../../../../shared/ui/Section";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuDetail } from "../../MenuDetail";
import { MenuWindow } from "../../MenuWindow";
import { financePaths } from "./paths";
import { ReportPage, type ReportView } from "./ReportPage";
import { SendReportButton } from "./SendReportSheet";
import { figureOf, noReportWords, periodRefusal } from "./reportPeriod";
import { budgetRow, dayStart, departmentRow, homeEmpty, listOf, moneyWords, periodEndOf, periodWords, reportPeriodOf, reportRow, text, tools, unitOf, type Item } from "./financeData";

const linesOf = (report: Item | null, unit: string) => (Array.isArray(report?.lines) ? (report?.lines as Item[]) : []).map((line) => budgetRow(line, unit));

const departmentsOf = (report: Item | null, unit: string) => {
  const departments = figureOf(report, "departments");
  return (Array.isArray(departments) ? (departments as Item[]) : []).map((figure) => departmentRow(figure, unit));
};

const loadReports = async () => (await listOf(tools.reportList)).map(reportRow);

const loadReport = async (id: string, unit: string) => {
  const period = reportPeriodOf(id);
  const report = (await callTool("", tools.reportRead, period)) as Item | null;
  return {
    id,
    name: text(report, "name"),
    period: periodWords(period.period_start, period.period_end),
    planned: moneyWords(figureOf(report, "planned") as number, unit),
    spent: moneyWords(figureOf(report, "spent") as number, unit),
    difference: moneyWords(figureOf(report, "difference") as number, unit),
    departments: departmentsOf(report, unit),
    lines: linesOf(report, unit),
  };
};

const loadChosen = async (id: string, unit: string) => {
  try {
    return await loadReport(id, unit);
  } catch {
    return { id, note: noReportWords };
  }
};

const reportBack = financePaths.reports.path();

const reportPage = (report: unknown) => (
  <ReportPage report={report as ReportView} heading="Financial Reports" back={reportBack}>
    <SendReportButton report={report as ReportView} />
  </ReportPage>
);

function ChoosePeriod({ unit }: { unit: string }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [refusal, setRefusal] = useState("");
  const [reading, setReading] = useState("");
  const read = () => {
    const words = periodRefusal(start, end);
    setRefusal(words);
    setReading(words ? "" : `${dayStart(start)}~${periodEndOf(end)}`);
  };
  return (
    <>
      <Section
        word="Choose period"
        plain
        rows={[
          <Field key="from" label="From" type="date" value={start} onChange={(event) => setStart(event.target.value)} />,
          <Field key="to" label="To" type="date" value={end} onChange={(event) => setEnd(event.target.value)} error={refusal || undefined} />,
        ]}
        foot={<button type="button" className="sec-act" onClick={read}>Read report</button>}
      />
      {reading ? <MenuDetail key={`${reading}${unit}`} bare id={reading} title="Financial Reports" tool={tools.reportRead} load={(id: string) => loadChosen(id, unit)} fields={{}} status="" extra={reportPage} /> : null}
    </>
  );
}

export function ReportsScreen() {
  const word = useWord("accounting");
  const unit = unitOf(word);
  return (
    <MenuWindow
      title={word("Financial Reports")}
      withTabs
      bandless
      detailKey={unit}
      above={<ChoosePeriod unit={unit} />}
      list={{ title: word("Financial Reports"), tool: tools.reportList, load: loadReports, fields: { title: "name", meta: "meta" }, empty: homeEmpty(`No ${word("Reports").toLowerCase()} yet.`) }}
      detail={{ tool: tools.reportRead, load: (id: string) => loadReport(id, unit), fields: {}, status: "", extra: reportPage }}
    />
  );
}

import { useState } from "react";
import { useWord } from "../../../../features/agency/useWord";
import { Button } from "../../../../shared/ui/Button";
import { Card } from "../../../../shared/ui/Card";
import { Field } from "../../../../shared/ui/Field";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuDetail } from "../../MenuDetail";
import { MenuWindow } from "../../MenuWindow";
import { budgetRow, dayStart, homeEmpty, listOf, moneyWords, periodEndOf, periodWords, reportPeriodOf, reportRow, text, tools, type Item } from "./financeData";

const missingPeriodWords = "Choose both a start date and an end date.";

const reversedPeriodWords = "The end date must not come before the start date.";

const periodRefusal = (start: string, end: string) => {
  if (!start || !end) return missingPeriodWords;
  return end < start ? reversedPeriodWords : "";
};

const figureOf = (report: Item | null, key: string) => (report?.figures as Item | undefined)?.[key];

const linesOf = (report: Item | null) => (Array.isArray(report?.lines) ? (report?.lines as Item[]) : []).map(budgetRow);

const linesWords = (lines: ReturnType<typeof budgetRow>[]) => lines.map((line) => `${line.name} · ${line.meta}`).join("; ");

const loadReports = async () => (await listOf(tools.reportList)).map(reportRow);

const loadReport = async (id: string) => {
  const period = reportPeriodOf(id);
  const report = (await callTool("", tools.reportRead, period)) as Item | null;
  return {
    id,
    name: text(report, "name"),
    period: periodWords(period.period_start, period.period_end),
    planned: moneyWords(figureOf(report, "planned") as number),
    spent: moneyWords(figureOf(report, "spent") as number),
    difference: moneyWords(figureOf(report, "difference") as number),
    lines: linesWords(linesOf(report)),
  };
};

const noReportWords = "No report could be read for that period.";

const loadChosen = async (id: string) => {
  try {
    return await loadReport(id);
  } catch {
    return { id, note: noReportWords };
  }
};

const reportFields = { Name: "name", Period: "period", Planned: "planned", Spent: "spent", Difference: "difference", "Budget lines": "lines" };

function ChoosePeriod() {
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
    <section aria-label="Choose period">
      <Card title="Choose period">
        <Field label="From" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        <Field label="To" type="date" value={end} onChange={(event) => setEnd(event.target.value)} error={refusal || undefined} />
        <Button kind="primary" onClick={read}>Read report</Button>
        {reading ? <MenuDetail key={reading} bare id={reading} title="Financial Reports" tool={tools.reportRead} load={loadChosen} fields={{ ...reportFields, Note: "note" }} status="status" /> : null}
      </Card>
    </section>
  );
}

export function ReportsScreen() {
  const word = useWord("accounting");
  return (
    <MenuWindow
      title={word("Financial Reports")}
      above={<ChoosePeriod />}
      list={{ title: word("Financial Reports"), tool: tools.reportList, load: loadReports, fields: { title: "name", meta: "meta" }, empty: homeEmpty(`No ${word("Reports").toLowerCase()} yet.`) }}
      detail={{ tool: tools.reportRead, load: loadReport, fields: reportFields, status: "status" }}
    />
  );
}

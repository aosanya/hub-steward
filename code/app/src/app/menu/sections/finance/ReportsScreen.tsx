import { callTool } from "../../../../shared/wakala/mcp";
import { MenuWindow } from "../../MenuWindow";
import { homeEmpty, listOf, moneyWords, periodWords, reportPeriodOf, reportRow, text, tools, type Item } from "./financeData";

const loadReports = async () => (await listOf(tools.reportList)).map(reportRow);

const figureOf = (report: Item | null, key: string) => ((report?.figures as Item | undefined)?.[key]);

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
  };
};

export function ReportsScreen() {
  return (
    <MenuWindow
      title="Financial Reports"
      list={{ title: "Financial Reports", tool: tools.reportList, load: loadReports, fields: { title: "name", meta: "meta" }, empty: homeEmpty("No reports yet.") }}
      detail={{ tool: tools.reportRead, load: loadReport, fields: { Name: "name", Period: "period", Planned: "planned", Spent: "spent", Difference: "difference" }, status: "status" }}
    />
  );
}

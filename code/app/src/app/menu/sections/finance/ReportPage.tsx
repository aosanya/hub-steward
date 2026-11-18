import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { ChatAboutFinance, FactsCard, FinanceHead } from "./FinanceRecord";
import { ReportActions } from "./ReportActions";
import type { Item } from "./financeData";

export type FigureRow = { name: string; meta: string };

export type ReportView = Item & { id: string; name?: string; period?: string; note?: string; departments?: FigureRow[]; lines?: FigureRow[] };

const reportFacts: [string, string][] = [
  ["Planned", "planned"],
  ["Spent", "spent"],
  ["Difference", "difference"],
];

const rowsOf = (figures: FigureRow[] | undefined) => (figures ?? []).map((figure) => <ListRow key={`${figure.name}${figure.meta}`} title={figure.name} meta={figure.meta} />);

type Props = { report: ReportView; heading: string; back: string };

export function ReportPage({ report, heading, back }: Props) {
  const name = report.name || heading;
  return (
    <div className="person-page">
      <ChatAboutFinance about={{ kind: "report", id: report.id, name }} back={back} />
      <ReportActions report={report} />
      <FinanceHead name={name} line={report.period ?? ""} />
      <div className="sections">
        {report.note ? <Section word="Report" plain rows={[<ListRow key="note" title={report.note} />]} /> : <FactsCard word="Report" item={report} facts={reportFacts} />}
        <Section word="Departments" plain rows={rowsOf(report.departments)} />
        <Section word="Budget lines" plain rows={rowsOf(report.lines)} />
      </div>
    </div>
  );
}

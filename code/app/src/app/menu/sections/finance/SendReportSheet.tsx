import { text, type Item } from "./financeData";
import { HandOverSheet } from "./HandOverSheet";

type Props = { report: Item; onClose: () => void };

const reportKeys = ["name", "period", "planned", "spent", "difference"];

export function SendReportSheet({ report, onClose }: Props) {
  return (
    <HandOverSheet
      title="Share"
      category="report"
      event="report_handed_over"
      subjectKind="report"
      subjectId={text(report, "id")}
      names={Object.fromEntries(reportKeys.map((key) => [key, text(report, key)]))}
      onClose={onClose}
    />
  );
}

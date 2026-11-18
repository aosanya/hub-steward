import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { ActionsMenu, type MenuAction } from "../../../../shared/ui/ActionsMenu";
import { downloadPdf } from "../../../../shared/ui/downloadPdf";
import { text } from "./financeData";
import type { FigureRow, ReportView } from "./ReportPage";
import { SendReportSheet } from "./SendReportSheet";

const raisePermission = "notification.raise";

const figureLines = (heading: string, rows: FigureRow[] | undefined) => (rows && rows.length > 0 ? ["", heading, ...rows.map((row) => `${row.name} - ${row.meta}`)] : []);

export const reportLines = (report: ReportView) => [
  ...(report.period ? [`Period: ${report.period}`] : []),
  ...["planned", "spent", "difference"].filter((key) => text(report, key) !== "").map((key) => `${key.charAt(0).toUpperCase()}${key.slice(1)}: ${text(report, key)}`),
  ...figureLines("Departments", report.departments),
  ...figureLines("Budget lines", report.lines),
];

export function ReportActions({ report }: { report: ReportView }) {
  const may = useMay(raisePermission);
  const [sharing, setSharing] = useState(false);
  const loaded = text(report, "id") !== "" && !report.note;
  const name = report.name || "Financial report";
  const actions: MenuAction[] = loaded
    ? [...(may ? [{ label: "Share", onSelect: () => setSharing(true) }] : []), { label: "Create PDF", onSelect: async () => downloadPdf(name, await (await import("../../../../shared/ui/reportPdf")).reportPdf(name, reportLines(report))) }]
    : [];
  return (
    <>
      <ActionsMenu align="start" actions={actions} />
      {sharing ? <SendReportSheet report={report} onClose={() => setSharing(false)} /> : null}
    </>
  );
}

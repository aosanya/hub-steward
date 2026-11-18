import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { liveRecordRowsTool, loadMayAddRows, resolveRecordCode } from "../../liveRecordRows";
import type { RecordFormField } from "../../RecordRowForm";

type Raw = Record<string, unknown>;

export const maintenanceRecordCode = "RC-3";

export const maintenanceFields: RecordFormField[] = [
  { prompt: "Asset", required: true },
  { prompt: "Date done", required: true, kind: "date" },
  { prompt: "Kind", required: true, options: ["Routine", "Repair", "Inspection"] },
  { prompt: "What was done", required: true },
  { prompt: "Done by", required: false },
  { prompt: "Cost", required: false, kind: "number" },
  { prompt: "Condition after", required: false, options: ["Good", "Fair", "Poor"] },
  { prompt: "Next due", required: false, kind: "date" },
  { prompt: "Work order", required: false },
  { prompt: "Notes", required: false },
];

export type Maintenance = { id: string; asset: string; done: string; kind: string; what: string; by: string };

const answerOf = (row: Raw, prompt: string) => {
  const value = (row.answers as Raw | undefined)?.[prompt];
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
};

const maintenanceOf = (row: Raw): Maintenance => ({
  id: typeof row.id === "string" ? row.id : "",
  asset: answerOf(row, "Asset"),
  done: answerOf(row, "Date done"),
  kind: answerOf(row, "Kind"),
  what: answerOf(row, "What was done"),
  by: answerOf(row, "Done by"),
});

const newestFirst = (one: Maintenance, two: Maintenance) => two.done.localeCompare(one.done);

export const assetLabelOf = (name: string, serialTag: string) => [name, serialTag].filter(Boolean).join(" ");

export const loadMaintenanceOf = async (assetName: string): Promise<Maintenance[]> => {
  try {
    const rows = itemsOf(await callTool("", liveRecordRowsTool, { record_code: await resolveRecordCode(maintenanceRecordCode) })) as Raw[];
    return rows.map(maintenanceOf).filter((one) => one.asset === assetName || one.asset.startsWith(`${assetName} `)).sort(newestFirst);
  } catch {
    return [];
  }
};

export const loadMayAddMaintenance = () => loadMayAddRows(maintenanceRecordCode).catch(() => false);

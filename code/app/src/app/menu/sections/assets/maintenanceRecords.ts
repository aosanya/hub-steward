import { loadMayAddRows, loadRegisterRows } from "../../liveRecordRows";
import type { RecordFormField } from "../../RecordRowForm";

type Raw = Record<string, unknown>;

export const maintenanceRecordCode = "RC-3";

export const maintenanceFields: RecordFormField[] = [
  { prompt: "Asset", required: true, assets: true },
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

export type Maintenance = { id: string; asset: string; done: string; kind: string; what: string; by: string; saved: string };

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
  saved: typeof row.created_at === "string" ? row.created_at : "",
});

const newestFirst = (one: Maintenance, two: Maintenance) => two.done.localeCompare(one.done) || two.saved.localeCompare(one.saved);

export { assetLabelOf } from "../../assetChoices";

type OfAsset = { id: string; name: string };

const isOfAsset = (asset: OfAsset) => (one: Maintenance) =>
  one.asset === asset.id || one.asset === asset.name || one.asset.startsWith(`${asset.name} `);

export const loadMaintenanceOf = async (asset: OfAsset): Promise<Maintenance[]> => {
  try {
    const rows = await loadRegisterRows(maintenanceRecordCode);
    return rows.map(maintenanceOf).filter(isOfAsset(asset)).sort(newestFirst);
  } catch {
    return [];
  }
};

export const loadMayAddMaintenance = () => loadMayAddRows(maintenanceRecordCode).catch(() => false);

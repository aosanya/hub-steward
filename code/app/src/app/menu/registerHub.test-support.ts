import type { MockInstance } from "vitest";
import * as mcp from "../../shared/wakala/mcp";
import { liveRecordsHub, recordFrom, recordServed, rowServed, type FakeRow } from "../../shared/wakala/liveRecords.test-support";
import { maintenanceFields } from "./sections/assets/maintenanceRecords";
import { businessFields } from "./sections/residents/BusinessesScreen";
import { informalTraderFields } from "./sections/residents/InformalTradersScreen";

export type Registers = {
  businesses?: FakeRow[];
  traders?: FakeRow[];
  maintenance?: FakeRow[];
  mayAdd?: boolean;
  added?: unknown;
  otherwise?: (tool: string, args: Record<string, unknown>) => unknown;
};

const promptsOf = (fields: { prompt: string }[]) => fields.map((field) => field.prompt);

export const registerRecordsOf = (rows: { businesses?: FakeRow[]; traders?: FakeRow[]; maintenance?: FakeRow[] } = {}, can_add_rows = true, extra: string[] = []) => ({
  businesses: recordFrom("RC-1", "Businesses", rows.businesses ?? [], [...promptsOf(businessFields), ...extra], { can_add_rows }),
  traders: recordFrom("RC-2", "Informal traders", rows.traders ?? [], [...promptsOf(informalTraderFields), ...extra], { can_add_rows }),
  maintenance: recordFrom("RC-3", "Maintenance records", rows.maintenance ?? [], [...promptsOf(maintenanceFields), ...extra], { can_add_rows }),
});

export const registersHub = (given: Registers = {}) => {
  const records = registerRecordsOf(given, given.mayAdd ?? true);
  const hub = liveRecordsHub({
    records: [records.businesses, records.traders, records.maintenance],
    rows: { "RC-1": given.businesses ?? [], "RC-2": given.traders ?? [], "RC-3": given.maintenance ?? [] },
    added: given.added,
    otherwise: given.otherwise,
  });
  return { records, hub };
};

export const servedAsHub = (spy: MockInstance<typeof mcp.callTool>, extra: string[] = []) => {
  const inner = spy.getMockImplementation();
  const records = Object.values(registerRecordsOf({}, true, extra));
  spy.mockImplementation(async (agency, tool, args) => {
    if (tool === "agency_list_live_records") {
      const own = (await Promise.resolve(inner?.(agency, tool, args)).catch(() => undefined)) as { items?: { name?: string; can_add_rows?: boolean }[] } | undefined;
      const mayAdd = (name: string) => own?.items?.find((item) => item.name === name)?.can_add_rows ?? true;
      return { items: records.map((record) => recordServed({ ...record, can_add_rows: mayAdd(record.name) })) };
    }
    const reply = (await inner?.(agency, tool, args)) as { items?: FakeRow[] } | undefined;
    if (tool !== "agency_list_live_record_rows" || !Array.isArray(reply?.items)) return reply;
    const record = records.find((one) => one.key === (args as { record_code?: string } | undefined)?.record_code);
    return { ...reply, items: reply.items.map((row) => (record ? rowServed(record, row) : row)) };
  });
  return spy;
};

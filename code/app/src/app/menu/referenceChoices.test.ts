import { beforeEach, expect, test, vi } from "vitest";
import { recordFrom, recordServed, rowServed } from "../../shared/wakala/liveRecords.test-support";
import { holderArgs, loadAccountChoices, loadBusinessChoices, loadHolderChoices, loadNeighbourhoodChoices, loadPersonIdChoices, loadRoleKindChoices, loadTraderChoices } from "./referenceChoices";

const callTool = vi.fn();

vi.mock("../../shared/wakala/mcp", () => ({ callTool: (...args: unknown[]) => callTool(...args) }));

const people = [
  { id: "p1", code: "AC-1", display_name: "" },
  { id: "p2", code: "AC-2", display_name: "Varga Mária" },
];

const groups = [{ id: "g1", name: "Zöldhalom Town Council" }, { id: "g2", name: "Zöldhalom Parish" }];

beforeEach(() => {
  callTool.mockReset();
  callTool.mockImplementation(async (_hub: string, tool: string) => ({ items: tool === "actor_list_groups" ? groups : people }));
});

test("a person without a name is offered as Unnamed person, never by code", async () => {
  expect(await loadPersonIdChoices()).toEqual([
    { value: "p1", label: "Unnamed person" },
    { value: "p2", label: "Varga Mária" },
  ]);
});

test("the holder choices offer every person, a nameless one as Unnamed person, and the groups that hold places", async () => {
  expect(await loadHolderChoices()).toEqual([
    { value: "person:p1", label: "Unnamed person" },
    { value: "person:p2", label: "Varga Mária" },
    { value: "body:Zöldhalom Town Council", label: "Zöldhalom Town Council" },
    { value: "body:Zöldhalom Parish", label: "Zöldhalom Parish" },
  ]);
});

test("a chosen person is sent by name and id, a chosen body by name alone", async () => {
  const choices = await loadHolderChoices();
  expect(holderArgs("person:p2", choices)).toEqual({ holder: "Varga Mária", holder_actor_id: "p2" });
  expect(holderArgs("body:Zöldhalom Parish", choices)).toEqual({ holder: "Zöldhalom Parish" });
  expect(holderArgs("", choices)).toEqual({ holder: "" });
});

const answerTable: Record<string, unknown> = {
  accounting_account_list: [
    { id: "ac1", code: "5000", name: "Road maintenance", category: "roads" },
    { id: "ac2", code: "5100", name: "", category: "books" },
    { id: "ac3", code: "", name: "", category: "salaries" },
  ],
  actor_list_levels: [{ name: "Neighbourhood", is_area: true }],
  actor_list_groups: [
    { id: "g1", name: "Óváros", node_type: "neighbourhood" },
    { id: "g2", name: "Zöldhalom Parish", node_type: "parish" },
  ],
  actor_list_role_kinds: [{ id: "k1", name: "Mayor" }, { id: "k2", name: "Clerk", retired_at: "2026-01-01" }],
};

const businessRows = [{ id: "r1", answers: { "Trading name": "Mill Corner Garage" } }, { id: "r2", answers: { "Trading name": "" } }];

const traderRows = [{ id: "r1", answers: { "Name or alias": "Lemonade Anna" } }, { id: "r2", answers: { "Name or alias": "" } }];

const businesses = recordFrom("RC-1", "Businesses", businessRows);

const traders = recordFrom("RC-2", "Informal traders", traderRows);

const registerReply = (tool: string, args: { record_code?: string } | undefined, rows: Record<string, unknown[]>) => {
  if (tool === "agency_list_live_records") return { items: [businesses, traders].map(recordServed) };
  const record = [businesses, traders].find((one) => one.key === args?.record_code);
  return { items: record ? (rows[record.key] as never[]).map((row) => rowServed(record, row)) : [] };
};

const answerFromTable = async (_hub: string, tool: string, args?: { record_code?: string }) =>
  tool.startsWith("agency_list_live") ? registerReply(tool, args, { "RC-1": businessRows, "RC-2": traderRows }) : { items: answerTable[tool] ?? [] };

test("a budget account reads by its name, then its category and code, never a bare code", async () => {
  callTool.mockImplementation(answerFromTable);
  expect(await loadAccountChoices()).toEqual([
    { value: "ac1", label: "Road maintenance" },
    { value: "ac2", label: "Books 5100" },
    { value: "ac3", label: "Salaries" },
  ]);
});

test("businesses and informal traders are offered by the name they trade under, and a nameless row is left out", async () => {
  callTool.mockImplementation(answerFromTable);
  expect(await loadBusinessChoices()).toEqual([{ value: "r1", label: "Mill Corner Garage" }]);
  expect(await loadTraderChoices()).toEqual([{ value: "r1", label: "Lemonade Anna" }]);
});

test("neighbourhoods are the area groups by name and role kinds are the open ones by name", async () => {
  callTool.mockImplementation(answerFromTable);
  expect(await loadNeighbourhoodChoices()).toEqual([{ value: "g1", label: "Óváros" }]);
  expect(await loadRoleKindChoices()).toEqual([{ value: "k1", label: "Mayor" }]);
});

test("the holder choices also offer the businesses and the informal traders by name with their kind", async () => {
  callTool.mockImplementation(async (_hub: string, tool: string, args?: { record_code?: string }) => {
    if (tool === "actor_list_groups") return { items: groups };
    if (tool.startsWith("agency_list_live")) return registerReply(tool, args, { "RC-1": [{ id: "b1", answers: { "Trading name": "Mill Corner Garage" } }], "RC-2": [{ id: "t1", answers: { "Name or alias": "Lemonade Anna" } }] });
    return { items: people };
  });
  const choices = await loadHolderChoices();
  expect(choices).toContainEqual({ value: "row:b1", label: "Mill Corner Garage", hint: "Business" });
  expect(choices).toContainEqual({ value: "row:t1", label: "Lemonade Anna", hint: "Informal trader" });
  expect(choices.slice(0, 2).map((choice) => choice.label)).toEqual(["Unnamed person", "Varga Mária"]);
});

test("a chosen business or trader is sent by name and record row id", async () => {
  const choices = [{ value: "row:b1", label: "Mill Corner Garage", hint: "Business" }];
  expect(holderArgs("row:b1", choices)).toEqual({ holder: "Mill Corner Garage", holder_record_row_id: "b1" });
});

test("a holder list still loads when the businesses cannot be read", async () => {
  callTool.mockImplementation(async (_hub: string, tool: string) => {
    if (tool.startsWith("agency_list_live")) throw new Error("denied");
    return { items: tool === "actor_list_groups" ? groups : people };
  });
  expect((await loadHolderChoices()).map((choice) => choice.label)).toEqual(["Unnamed person", "Varga Mária", "Zöldhalom Town Council", "Zöldhalom Parish"]);
});

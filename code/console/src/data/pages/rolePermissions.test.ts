import { beforeEach, expect, test, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { heldPermissions } from "./rolePermissions";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const call = vi.mocked(callTool);

const answerWith = (replies: Record<string, unknown>) =>
  call.mockImplementation((async (_hub: string, tool: string) => {
    const reply = replies[tool];
    if (reply instanceof Error) throw reply;
    return reply ?? { items: [] };
  }) as typeof callTool);

const records = {
  items: [
    { id: "rec1", code: "tender", name: "Tenders", item_name: "Tender" },
    { id: "rec2", code: "day_worked", name: "Days worked", item_name: "" },
  ],
};

beforeEach(() => {
  call.mockReset();
  answerWith({ agency_list_permissions: { items: [{ code: "report.read", name: "Read reports" }] }, agency_list_records: records });
});

test("a role with no permission reads nothing", async () => {
  expect(await heldPermissions("h1", [])).toEqual([]);
  expect(call).not.toHaveBeenCalled();
});

test("a catalogue code takes its name from the permission list", async () => {
  expect(await heldPermissions("h1", ["report.read"])).toEqual([{ code: "report.read", name: "Read reports", action: null, item: "" }]);
});

test("a record code is worded from its action and the record's item name, falling back to the record's name", async () => {
  const held = await heldPermissions("h1", ["record.tender.add", "record.tender.view", "record.day_worked.delete", "record.tender.edit"]);

  expect(held.map(({ action, item }) => [action, item])).toEqual([
    ["add", "Tender"],
    ["view", "Tender"],
    ["delete", "Days worked"],
    ["edit", "Tender"],
  ]);
});

test("a record code the permission list names keeps that name", async () => {
  answerWith({ agency_list_permissions: { items: [{ code: "record.tender.add", name: "Add a tender" }] }, agency_list_records: records });

  expect((await heldPermissions("h1", ["record.tender.add"]))[0]).toMatchObject({ code: "record.tender.add", name: "Add a tender" });
});

test("a record code of a record that is not there, or with an action that is not one, stays a bare code", async () => {
  const held = await heldPermissions("h1", ["record.gone.add", "record.tender.archive", "record.tender"]);

  expect(held).toEqual(held.map(({ code }) => ({ code, name: "", action: null, item: "" })));
});

test("the records are read only when a record code is held", async () => {
  await heldPermissions("h1", ["report.read"]);
  expect(call.mock.calls.filter(([, tool]) => tool === "agency_list_records")).toEqual([]);
});

test("codes come back, unnamed, when neither lookup can be read", async () => {
  answerWith({ agency_list_permissions: new McpError("down"), agency_list_records: new McpError("down") });

  expect(await heldPermissions("h1", ["report.read", "record.tender.add"])).toEqual([
    { code: "report.read", name: "", action: null, item: "" },
    { code: "record.tender.add", name: "", action: null, item: "" },
  ]);
});

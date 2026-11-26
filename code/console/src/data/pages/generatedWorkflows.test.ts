import { beforeEach, expect, test, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { loadGenerated, loadGeneratedDetail, slotsOf } from "./generatedWorkflows";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const call = vi.mocked(callTool);

const answerWith = (replies: Record<string, unknown>) =>
  call.mockImplementation((async (_hub: string, tool: string) => replies[tool] ?? { items: [] }) as typeof callTool);

const field = (code: string, required: boolean) => ({ key: code + "-key", code, prompt: code, answer_type: "free_text", required });

const tender = {
  id: "rec1",
  code: "tender",
  name: "Tenders",
  item_name: "Tender",
  questions: [field("title", true), field("closing_date", true), field("note", false)],
};

const generated = (id: string, code: string) => ({ id, code, name: code, generated: true, generated_for: "tender" });

const workflows = {
  items: [generated("g1", "record.tender.add"), generated("g2", "record.tender.edit"), generated("g3", "record.tender.delete")],
};

const role = (id: string, name: string, permissions: string[]) => ({ id, name, permissions });

const holdersOf = async (roles: unknown[], record: Record<string, unknown> = tender) => {
  answerWith({ agency_list_workflows: workflows, agency_list_records: { items: [record] }, agency_list_roles: { items: roles } });
  const set = await loadGenerated("h1");
  return Object.fromEntries(set.workflows.map((workflow) => [workflow.code.split(".").pop(), workflow.heldBy]));
};

beforeEach(() => {
  call.mockReset();
});

test("a role with add.* holds the add step, with edit.* the edit step, with delete the delete step", async () => {
  const held = await holdersOf([
    role("r1", "Adder", ["record.tender.add.*"]),
    role("r2", "Editor", ["record.tender.edit.*"]),
    role("r3", "Remover", ["record.tender.delete"]),
  ]);

  expect(held).toEqual({ add: ["Adder"], edit: ["Editor"], delete: ["Remover"] });
});

test("the add step is held by a role that carries add for every required field and by no role that misses one", async () => {
  const held = await holdersOf([
    role("r1", "Both required", ["record.tender.add.title", "record.tender.add.closing_date"]),
    role("r2", "One required", ["record.tender.add.title", "record.tender.add.note"]),
  ]);

  expect(held.add).toEqual(["Both required"]);
});

test("a record with no required field has its add step held by a role with add.* or any one add field", async () => {
  const optional = { ...tender, questions: [field("title", false), field("note", false)] };

  const held = await holdersOf(
    [role("r1", "Star", ["record.tender.add.*"]), role("r2", "One field", ["record.tender.add.note"]), role("r3", "Other record", ["record.other.add.*"])],
    optional,
  );

  expect(held.add).toEqual(["Star", "One field"]);
});

test("the edit step is held by a role that carries edit for any one field", async () => {
  const held = await holdersOf([role("r1", "One field", ["record.tender.edit.note"]), role("r2", "Unknown field", ["record.tender.edit.colour"])]);

  expect(held.edit).toEqual(["One field"]);
});

test("every role that carries the codes is a holder, in the order the roles are listed", async () => {
  const held = await holdersOf([
    role("r1", "First", ["record.tender.delete"]),
    role("r2", "Second", ["report.read"]),
    role("r3", "Third", ["record.tender.delete", "record.tender.add.*"]),
  ]);

  expect(held).toEqual({ add: ["Third"], edit: [], delete: ["First", "Third"] });
});

test("the fields a record no longer has name no holder", async () => {
  const held = await holdersOf(
    [role("r1", "Named by the old field", [])],
    { ...tender, role_id: "r1", edit_role_id: "r1", delete_role_id: "r1", viewer_role_id: "r1" },
  );

  expect(held).toEqual({ add: [], edit: [], delete: [] });
});

test("the record carries the holders of each of its actions", async () => {
  answerWith({
    agency_list_workflows: workflows,
    agency_list_records: { items: [tender] },
    agency_list_roles: { items: [role("r1", "Everything", ["record.tender.add.*", "record.tender.edit.*", "record.tender.delete"])] },
  });

  expect((await loadGenerated("h1")).records[0].heldBy).toEqual({ add: ["Everything"], edit: ["Everything"], delete: ["Everything"] });
});

const uuid = "fb0683d8-a79b-4344-bbb2-363c25c6c517";

const keyed = { id: "rec9", key: uuid, code: "tender", name: "Tenders", item_name: "Tender", questions: [field("title", true)] };

const renamedOld = { id: "rec3", key: "RC-3", code: "client", name: "Clients", item_name: "Client", questions: [field("title", true)] };

const madeFor = (key: string, code: string) =>
  ["add", "edit", "delete"].map((action) => ({ id: `${code}-${action}`, code: `record.${code}.${action}`, name: `${action} ${code}`, generated: true, generated_for: key }));

const everything = (code: string) => [`record.${code}.add.*`, `record.${code}.edit.*`, `record.${code}.delete`];

const keyedHub = {
  agency_list_workflows: { items: [...madeFor(uuid, "tender"), ...madeFor("RC-3", "client")] },
  agency_list_records: { items: [keyed, renamedOld] },
  agency_list_roles: { items: [role("r1", "Scout", [...everything("tender"), ...everything("client")])] },
};

test("a generated workflow made for a record's key names the record and its holders, for a new key and an old RC-n key", async () => {
  answerWith(keyedHub);

  const set = await loadGenerated("h1");

  expect(set.workflows.map((workflow) => [workflow.record.name, workflow.record.code, workflow.heldBy])).toEqual([
    ...Array(3).fill(["Tenders", "tender", ["Scout"]]),
    ...Array(3).fill(["Clients", "client", ["Scout"]]),
  ]);
});

test("every record named by its key has its three generated workflows", async () => {
  answerWith(keyedHub);

  const set = await loadGenerated("h1");

  expect(set.records.map((record) => slotsOf(set, record).map((slot) => slot.workflow?.id))).toEqual([
    ["tender-add", "tender-edit", "tender-delete"],
    ["client-add", "client-edit", "client-delete"],
  ]);
});

test("a reference is matched with a record's key before another record's code", async () => {
  const lookalike = { id: "rec7", key: "8a1f0c52-5d3e-4a53-9a01-6d2f7b1f0c11", code: "RC-3", name: "Lookalikes", questions: [] };
  answerWith({ ...keyedHub, agency_list_records: { items: [lookalike, renamedOld] } });

  const set = await loadGenerated("h1");

  expect(set.workflows.filter((workflow) => workflow.code.startsWith("record.client.")).map((workflow) => workflow.record.name)).toEqual(["Clients", "Clients", "Clients"]);
  expect(slotsOf(set, set.records[0]).map((slot) => slot.workflow)).toEqual([null, null, null]);
});

test("a step's row record, given as a key, names the record", async () => {
  answerWith({
    ...keyedHub,
    agency_list_work_items: { items: [{ id: "s1", workflow_id: "tender-add", ordinality: 1, title: "Add a tender", row_record: uuid, row_action: "add" }] },
  });

  const detail = await loadGeneratedDetail("h1", "tender-add");

  expect(detail?.steps[0].record).toMatchObject({ name: "Tenders", code: "tender" });
});

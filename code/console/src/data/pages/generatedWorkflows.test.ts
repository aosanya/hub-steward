import { beforeEach, expect, test, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { loadGenerated } from "./generatedWorkflows";

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

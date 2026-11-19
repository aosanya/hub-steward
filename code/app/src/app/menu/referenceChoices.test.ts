import { beforeEach, expect, test, vi } from "vitest";
import { holderArgs, loadHolderChoices, loadPersonIdChoices } from "./referenceChoices";

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

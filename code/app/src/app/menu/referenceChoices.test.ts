import { beforeEach, expect, test, vi } from "vitest";
import { loadPersonIdChoices, loadPersonNameChoices } from "./referenceChoices";

const callTool = vi.fn();

vi.mock("../../shared/wakala/mcp", () => ({ callTool: (...args: unknown[]) => callTool(...args) }));

const people = [
  { id: "p1", code: "AC-1", display_name: "" },
  { id: "p2", code: "AC-2", display_name: "Varga Mária" },
];

beforeEach(() => {
  callTool.mockReset();
  callTool.mockResolvedValue({ items: people });
});

test("a person without a name is offered as Unnamed person, never by code", async () => {
  expect(await loadPersonIdChoices()).toEqual([
    { value: "p1", label: "Unnamed person" },
    { value: "p2", label: "Varga Mária" },
  ]);
});

test("the holder choices keep only people who have a name", async () => {
  expect(await loadPersonNameChoices()).toEqual([{ value: "Varga Mária", label: "Varga Mária" }]);
});

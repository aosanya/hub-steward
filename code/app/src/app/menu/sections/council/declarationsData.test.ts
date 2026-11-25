import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../../../../shared/wakala/mcp";
import { readDeclarations } from "./declarationsData";

const declaredRow = (extra: Record<string, unknown>) => ({ row_id: "d1", name: "Zsofia Varga", declared_on: "2026-03-02", ...extra });

const read = async (row: Record<string, unknown>) => {
  vi.spyOn(mcp, "callTool").mockResolvedValue({ declared: [declaredRow(row)], not_declared: [], not_declared_count: 0, can_read_all: false });
  return (await readDeclarations()).declared[0].answers;
};

describe("declarations read the prompt beside each answer", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the prompt, not the field key", async () => {
    const answers = await read({
      answers: { f_1: "No", f_2: "A cousin" },
      fields: [
        { key: "f_1", prompt: "Do you hold an office?", value: "No" },
        { key: "f_2", prompt: "Which relatives work for the town?", value: "A cousin" },
      ],
    });
    expect(answers).toEqual([
      { prompt: "Do you hold an office?", answer: "No" },
      { prompt: "Which relatives work for the town?", answer: "A cousin" },
    ]);
  });

  it("shows a renamed question under its new prompt", async () => {
    const answers = await read({ answers: { f_1: "Mill" }, fields: [{ key: "f_1", prompt: "Firms you own part of", value: "Mill" }] });
    expect(answers).toEqual([{ prompt: "Firms you own part of", answer: "Mill" }]);
  });
});

import { filled, labelOf, standingTone } from "./labels";

const words = { standingProven: "Proven", riskKindDataLoss: "Data loss" } as never;

describe("risk labels", () => {
  it("reads a snake-case value through its camel-case word", () => {
    expect(labelOf(words, "standing", "proven")).toBe("Proven");
    expect(labelOf(words, "riskKind", "data_loss")).toBe("Data loss");
  });

  it("falls back to the value itself when no word is defined", () => {
    expect(labelOf(words, "standing", "unknown_state")).toBe("unknown_state");
  });

  it("fills named slots and leaves a missing value empty", () => {
    expect(filled("{count} of {total} proven", { count: 3, total: 5 })).toBe("3 of 5 proven");
    expect(filled("{count} of {total}", { count: 3 })).toBe("3 of ");
    expect(filled("no slots", { count: 1 })).toBe("no slots");
  });

  it("gives a standing its tone", () => {
    expect(standingTone("proven")).toBe("success");
    expect(standingTone("failing")).toBe("danger");
    expect(standingTone("weak")).toBe("info");
    expect(standingTone("untested")).toBeUndefined();
  });
});

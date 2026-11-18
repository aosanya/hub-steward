import { describe, expect, it } from "vitest";
import { systemPrompt } from "./api";
import { pageLines, readsOnlyRule } from "./triager";

describe("the rule that the assistant states only what it read", () => {
  it("names what it cannot read and forbids an answer of none for it", () => {
    expect(readsOnlyRule).toMatch(/cannot read/i);
    expect(readsOnlyRule).toMatch(/bills/i);
    expect(readsOnlyRule).toMatch(/never say there are none/i);
  });

  it("is in the page lines that follow the role's own description", () => {
    expect(pageLines).toContain(readsOnlyRule);
  });

  it("is in the fallback prompt when the hub has no Triager description", () => {
    expect(systemPrompt).toContain(readsOnlyRule);
  });
});

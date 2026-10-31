import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../wakala/mcp";
import { draftBackground } from "./enhanceBackground";

vi.mock("../wakala/mcp");

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockImplementation(async (_hub, tool) => {
    if (tool === "agency_list_consequences") return { items: [{ id: "q1", code: "Q-1", title: "Harvest spoilage" }] } as never;
    if (tool === "agency_list_hazards") return { items: [{ id: "h1", code: "H-1", title: "Unsold harvest" }] } as never;
    return { items: [] } as never;
  });
});

describe("the background of a consequences review", () => {
  it("states that every consequence needs a hazard and lists both sets", async () => {
    const text = await draftBackground("hub", "consequences");
    expect(text).toContain("every consequence must be attached to a hazard");
    expect(text).toContain("Harvest spoilage");
    expect(text).toContain("Unsold harvest");
  });

  it("adds no rule to a page that has none", async () => {
    expect(await draftBackground("hub", "hazards")).not.toContain("Rule for this review");
  });
});

describe("the background of a roles review while a draft is open", () => {
  it("lists the permissions with no arguments and the roles of the draft", async () => {
    vi.mocked(callTool).mockImplementation(async (_hub, tool) => {
      if (tool === "agency_list_drafts") return { items: [{ id: "d1", status: "open", description: "" }] } as never;
      if (tool === "agency_list_permissions") return { items: [{ code: "market.sell", name: "Sell on the market" }] } as never;
      return { items: [] } as never;
    });
    const text = await draftBackground("hub", "roles");
    const argsOf = (tool: string) => vi.mocked(callTool).mock.calls.filter(([, name]) => name === tool).map(([, , args]) => args ?? {});
    expect(argsOf("agency_list_permissions")).toEqual([{}]);
    expect(argsOf("agency_list_roles")).toEqual([{ draft_id: "d1" }]);
    expect(text).toContain("Sell on the market");
  });
});

import { vi } from "vitest";
import * as mcp from "../../shared/wakala/mcp";
import { populationFigure } from "./populationFigure";

afterEach(() => vi.restoreAllMocks());

describe("populationFigure", () => {
  it("returns the recorded population of the group", async () => {
    const spy = vi.spyOn(mcp, "callTool").mockResolvedValue({ group_id: "g1", population: 48 });

    expect(await populationFigure("g1")).toBe(48);
    expect(spy).toHaveBeenCalledWith("", "actor_get_group_population", { group_id: "g1" });
  });

  it("returns null when the hub refuses because no figure is recorded", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new mcp.McpError("no population figure recorded for the group"));

    expect(await populationFigure("g2")).toBeNull();
  });

  it("returns null when the reply carries no numeric population", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ group_id: "g3" });

    expect(await populationFigure("g3")).toBeNull();
  });
});

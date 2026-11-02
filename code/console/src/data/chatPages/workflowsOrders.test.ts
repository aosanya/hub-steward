import { describe, expect, it, vi } from "vitest";
import { isReadTool, type ToolInfo } from "../../wakala/mcp";
import { inFamily, suggestToolsOf, suggestionsToolOf, toolFamilyOf, writeToolsOf } from "../chatTools";
import { chatPageOf } from "./index";

vi.mock("../features", () => ({
  measuresOn: true,
  withoutMeasuresOff: (tools: string[]) => tools,
}));

const orderReads = ["taskmanager_workflow_run_list_under_way", "taskmanager_workflow_run_list_closed"];

const stop = "taskmanager_workflow_run_stop";

const stopTool: ToolInfo = {
  name: stop,
  description: "End one run at once.",
  inputSchema: { type: "object", properties: { instance_id: {}, runID: {}, reason: {}, restart_on_version: {} } },
};

describe("the Workflows page chat and the orders under way", () => {
  it("reads the orders under way and the closed ones, by look-up tools", () => {
    for (const read of orderReads) {
      expect(chatPageOf("workflows")!.reads).toContain(read);
      expect(isReadTool(read)).toBe(true);
      expect(inFamily(read, toolFamilyOf("workflows"))).toBe(true);
    }
  });

  it("proposes stopping an order for the manager to apply, and never stops one itself", () => {
    expect(suggestToolsOf("workflows")).toContain(stop);
    expect(writeToolsOf("workflows")).not.toContain(stop);
    expect(inFamily(stop, toolFamilyOf("workflows"))).toBe(false);
  });

  it("tells the model which arguments a stop carries, the version to start again on included", () => {
    const description = suggestionsToolOf("workflows", [stopTool])!.description;

    expect(description).toContain(`${stop}(runID, reason, restart_on_version)`);
  });

  it("keeps the curated read list within eighteen tools", () => {
    expect(chatPageOf("workflows")!.reads.length).toBeLessThanOrEqual(18);
  });
});

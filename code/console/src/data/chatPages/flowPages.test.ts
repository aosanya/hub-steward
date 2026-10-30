import { describe, expect, it, vi } from "vitest";
import { isReadTool } from "../../wakala/mcp";
import { inFamily, toolFamilyOf, writeToolsOf } from "../chatTools";
import { chatPageOf } from "./index";

vi.mock("../features", () => ({
  measuresOn: true,
  withoutMeasuresOff: (tools: string[]) => tools,
}));

const pages = ["workflows", "test", "profile", "publish"];

const needed: Record<string, string[]> = {
  workflows: [
    "agency_get_agency",
    "agency_list_workflows",
    "agency_list_work_items",
    "agency_list_records",
    "agency_list_scenarios",
    "agency_list_roles",
    "agency_list_objectives",
    "agency_list_workflow_objectives",
    "agency_list_role_assignments_for_work_item",
  ],
  test: [
    "agency_get_agency",
    "agency_list_scenarios",
    "agency_list_test_runs",
    "agency_list_workflows",
    "agency_list_roles",
    "agency_list_pickers",
  ],
  profile: [
    "agency_get_agency",
    "agency_list_goals",
    "agency_list_objectives",
    "agency_list_roles",
    "agency_list_values",
    "agency_list_rules",
    "agency_list_workflows",
    "instance_get_join_mode",
  ],
  publish: [
    "agency_get_agency",
    "agency_list_issues",
    "agency_list_publications",
    "agency_list_goals",
    "agency_list_objectives",
    "agency_get_objective",
    "agency_list_measures",
    "agency_list_roles",
    "agency_list_workflows",
    "agency_list_workflow_objectives",
  ],
};

describe("the chat of the Workflows, Test, Profile and Publish pages", () => {
  for (const page of pages) {
    it(`${page} reads only by look-up tools and writes nothing dangerous`, () => {
      const chat = chatPageOf(page);
      expect(chat).not.toBeNull();
      for (const read of chat!.reads)
        expect(read.endsWith("_") || isReadTool(read)).toBe(true);
      for (const write of chat!.writes) {
        expect(isReadTool(write)).toBe(false);
        expect(write).not.toMatch(/delete|detach|archive|publish|run|stop/);
      }
      expect(chat!.reads.length).toBeLessThanOrEqual(18);
    });

    it(`${page} offers the reads a manager needs there`, () => {
      for (const tool of needed[page])
        expect(inFamily(tool, toolFamilyOf(page))).toBe(true);
    });

    it(`${page} writes exactly what its page file lists`, () => {
      expect(writeToolsOf(page)).toEqual(chatPageOf(page)!.writes);
    });
  }

  it("leaves the Publish page without any write", () => {
    expect(writeToolsOf("publish")).toEqual([]);
  });

  it("keeps the instance reads on the Profile page", () => {
    expect(toolFamilyOf("profile")).toContain("instance_");
  });
});

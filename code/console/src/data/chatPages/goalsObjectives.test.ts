import { describe, expect, it, vi } from "vitest";
import { isReadTool } from "../../wakala/mcp";
import { toolFamilyOf, writeToolsOf } from "../chatTools";
import { chatPageOf } from "./index";

vi.mock("../features", () => ({
  measuresOn: true,
  withoutMeasuresOff: (tools: string[]) => tools,
}));

const forbidden = /delete|archive|publish|run|stop/;

describe.each(["goals", "objectives"])("%s page chat", (page) => {
  const chat = chatPageOf(page)!;

  it("is registered and feeds the tool lists", () => {
    expect(chat).not.toBeNull();
    expect(toolFamilyOf(page)).toEqual(chat.reads);
    expect(writeToolsOf(page)).toEqual(chat.writes);
  });

  it("keeps the reads curated and read-only", () => {
    expect(chat.reads.length).toBeLessThanOrEqual(16);
    for (const name of chat.reads) {
      expect(isReadTool(name)).toBe(true);
    }
    expect(chat.reads).not.toContain("agency_");
  });

  it("lists writes that are not reads and not destructive", () => {
    expect(chat.writes.length).toBeGreaterThan(0);
    for (const name of chat.writes) {
      expect(isReadTool(name)).toBe(false);
      expect(name).not.toMatch(forbidden);
    }
  });

  it("lets a manager review and assign", () => {
    expect(chat.reads).toEqual(
      expect.arrayContaining([
        "agency_get_agency",
        "agency_list_objectives",
        "agency_list_goals",
        "agency_list_roles",
        "agency_list_measures",
      ]),
    );
    expect(chat.writes).toEqual(
      expect.arrayContaining(["agency_update_objective", "agency_link_workflow_objective"]),
    );
  });
});

describe("goals page chat", () => {
  const chat = chatPageOf("goals")!;

  it("leaves goal creation to the direct create_goals tool", () => {
    expect(chat.writes).not.toContain("agency_create_goal");
    expect(chat.writes).toContain("agency_update_goal");
  });
});

describe("objectives page chat", () => {
  const chat = chatPageOf("objectives")!;

  it("reads measures and objectives and writes measures", () => {
    expect(chat.reads).toEqual(
      expect.arrayContaining([
        "agency_list_measures",
        "agency_list_objectives",
        "agency_list_workflows",
        "agency_list_modules",
      ]),
    );
    expect(chat.writes).toEqual(["agency_create_objective", "agency_update_objective", "agency_link_workflow_objective", "agency_set_measure"]);
    expect(chat.reads).toEqual(expect.arrayContaining(["agency_list_workflow_objectives", "agency_list_role_assignments_for_work_item"]));
    expect(chat.reads).not.toContain("agency_list_role_assignments_for_objective");
    expect(chat.suggests).toContain("agency_delete_workflow_objective");
    expect(chat.reads.filter((tool) => tool.includes("module"))).toEqual(["agency_list_modules"]);
    expect((chat.suggests ?? []).filter((tool) => tool.includes("module"))).toEqual([]);
    expect(chat.writes).toEqual(
      expect.arrayContaining([
        "agency_create_objective",
        "agency_set_measure",
        "agency_link_workflow_objective",
      ]),
    );
  });
});

describe("modules page chat", () => {
  const chat = chatPageOf("modules")!;

  it("reads the agency, its modules, workflows and work items and switches modules", () => {
    expect(chat.reads).toEqual(["agency_get_agency", "agency_list_modules", "agency_list_workflows", "agency_list_work_items"]);
    expect(chat.writes).toEqual(["agency_set_module_enabled"]);
    expect(chat.suggests).toEqual(["agency_set_module_enabled"]);
    expect(writeToolsOf("modules")).toEqual(chat.writes);
  });
});

import { describe, expect, it } from "vitest";
import { McpError } from "./mcp";
import { accessRefused, instanceNotFound, permissionRefused } from "./refusal";

const namedPermission =
  'taskmanager_task_list: dispatch: the caller may not perform that action: you need the permission "See the issues" (task.read) in this agency to do this; ask its owner to give it to one of your roles';

const unnamedPermission =
  "agency_get_agency: dispatch: the caller may not perform that action: you need a permission that allows agency.agency.read in this agency; ask its owner to give it to one of your roles";

describe("a refusal of access to an agency", () => {
  it("knows a non-member's answer", () => {
    const answer = new McpError("agencies: instance not found");
    expect(instanceNotFound(answer)).toBe(true);
    expect(permissionRefused(answer)).toBe(false);
    expect(accessRefused(answer)).toBe(true);
  });

  it("knows a resident's refusal that names the permission", () => {
    for (const message of [namedPermission, unnamedPermission]) {
      const answer = new McpError(message);
      expect(permissionRefused(answer)).toBe(true);
      expect(instanceNotFound(answer)).toBe(false);
      expect(accessRefused(answer)).toBe(true);
    }
  });

  it("does not take any other failure for a refusal", () => {
    for (const answer of [new McpError("wakala answered 500"), new McpError("taskmanager_task_move_to_step: agencies: backlog access forbidden: moving needs Can move on both backlogs"), new McpError("unknown tool"), "agencies: instance not found", null]) {
      expect(accessRefused(answer)).toBe(false);
    }
  });
});

import { describe, expect, it } from "vitest";
import { isReadTool } from "../../wakala/mcp";
import { toolFamilyOf, writeToolsOf } from "../chatTools";
import { chatPageOf } from "./index";

const forbidden = /delete|detach|archive|publish|run|stop/;

describe.each(["roles", "bowties"])("%s chat page", (page) => {
  it("is registered", () => {
    expect(chatPageOf(page)).not.toBeNull();
  });

  it("reads only through read tools or prefixes", () => {
    for (const name of toolFamilyOf(page))
      expect(name.endsWith("_") || isReadTool(name), name).toBe(true);
  });

  it("keeps its reads list curated", () => {
    expect(toolFamilyOf(page).length).toBeLessThanOrEqual(16);
    expect(toolFamilyOf(page)).not.toContain("agency_");
  });

  it("writes only through tools that are not read tools", () => {
    for (const name of writeToolsOf(page))
      expect(isReadTool(name), name).toBe(false);
  });

  it("offers no destructive write", () => {
    for (const name of writeToolsOf(page)) expect(name).not.toMatch(forbidden);
  });
});

describe("roles chat page", () => {
  it("lists roles and creates and updates them", () => {
    expect(toolFamilyOf("roles")).toContain("agency_list_roles");
    expect(writeToolsOf("roles")).toEqual(
      expect.arrayContaining(["agency_create_role", "agency_update_role"]),
    );
  });
});

describe("risks chat page tools", () => {
  it("reads the risk register", () => {
    expect(toolFamilyOf("risks")).toEqual(
      expect.arrayContaining(["agency_list_risks", "agency_get_risk", "agency_list_risk_pathways"]),
    );
  });

  it("creates risks and their threats and consequences directly", () => {
    expect(writeToolsOf("risks")).toEqual([
      "agency_create_risk",
      "agency_update_risk",
      "agency_create_risk_pathway",
      "agency_update_risk_pathway",
    ]);
  });
});

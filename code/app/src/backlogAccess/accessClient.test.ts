import { beforeEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../wakala/mcp";
import { accessTools, mcpBacklogAccessClient } from "./api";
import { AccessRefused } from "./types";

beforeEach(() => vi.restoreAllMocks());

describe("reading the access", () => {
  it("asks the hub for the backlog's access by id", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ owner_group: "po", groups: [{ group_id: "core", level: "move" }] } as never);
    const reading = await mcpBacklogAccessClient.read("b1");
    expect(call).toHaveBeenCalledWith("", accessTools.list, { backlogID: "b1" });
    expect(reading).toEqual({ ownerGroup: "po", grants: [{ groupId: "core", level: "move", roleTooSmall: false, noRole: false, roles: [] }] });
  });

  it("drops a grant with no group and a role code that is not text", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ groups: [{ level: "see" }, { group_id: "g", roles: ["backlog_member", "", 4], no_role: true, role_too_small: true }] } as never);
    expect(await mcpBacklogAccessClient.read("b1")).toEqual({ ownerGroup: "", grants: [{ groupId: "g", level: "see", roleTooSmall: true, noRole: true, roles: ["backlog_member"] }] });
  });

  it("reads an unknown level as Can see", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ groups: [{ group_id: "g", level: "owner" }] } as never);
    expect((await mcpBacklogAccessClient.read("b1")).grants[0].level).toBe("see");
  });
});

describe("the groups", () => {
  it("reads groups from a list or from items, and drops one with no id or no name", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [{ id: "a", name: "A", hierarchy_id: "h" }, { group_id: "b", name: "B" }, { id: "c" }, { name: "D" }] } as never);
    expect(await mcpBacklogAccessClient.groups()).toEqual([
      { id: "a", name: "A", hierarchyId: "h" },
      { id: "b", name: "B", hierarchyId: "" },
    ]);
    expect(mcp.callTool).toHaveBeenCalledWith("", accessTools.groups, {});
  });

  it("reads a bare array of groups", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue([{ id: "a", name: "A" }] as never);
    expect(await mcpBacklogAccessClient.groups()).toEqual([{ id: "a", name: "A", hierarchyId: "" }]);
  });
});

describe("changing the access", () => {
  it("gives a level to a group", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({} as never);
    await mcpBacklogAccessClient.set("b1", "g1", "edit");
    expect(call).toHaveBeenCalledWith("", accessTools.give, { backlogID: "b1", groupID: "g1", level: "edit" });
  });

  it("takes access away from a group", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({} as never);
    await mcpBacklogAccessClient.remove("b1", "g1");
    expect(call).toHaveBeenCalledWith("", accessTools.take, { backlogID: "b1", groupID: "g1" });
  });

  it("names the owner group", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({} as never);
    await mcpBacklogAccessClient.setOwnerGroup("g1");
    expect(call).toHaveBeenCalledWith("", accessTools.ownerGroup, { group_id: "g1" });
  });

  it("turns a refusal into the hub's words, without the tool name", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new mcp.McpError("access_give: you cannot grant above your own level"));
    const error = await mcpBacklogAccessClient.set("b1", "g1", "edit").catch((one) => one);
    expect(error).toBeInstanceOf(AccessRefused);
    expect(error.message).toBe("you cannot grant above your own level");
    await expect(mcpBacklogAccessClient.remove("b1", "g1")).rejects.toBeInstanceOf(AccessRefused);
    await expect(mcpBacklogAccessClient.setOwnerGroup("g1")).rejects.toBeInstanceOf(AccessRefused);
  });

  it("refuses with no words when the failure is not one the hub explained", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new TypeError("network down"));
    const error = await mcpBacklogAccessClient.set("b1", "g1", "see").catch((one) => one);
    expect(error).toBeInstanceOf(AccessRefused);
    expect(error.message).toBe("");
  });
});

describe("telling a smart backlog", () => {
  it("is smart only when the listed backlog with that id is of kind smart", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [{ id: "s1", kind: "smart" }, { id: "b1" }] } as never);
    expect(await mcpBacklogAccessClient.isSmart("s1")).toBe(true);
    expect(await mcpBacklogAccessClient.isSmart("b1")).toBe(false);
    expect(await mcpBacklogAccessClient.isSmart("missing")).toBe(false);
  });
});

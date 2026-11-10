import { beforeEach, describe, expect, it, vi } from "vitest";
import { accessTools } from "../backlogAccess/api";
import { taskTools } from "../backlogs/api";
import * as mcp from "../wakala/mcp";
import { mcpBacklogPageClient } from "./api";

const backlogs = {
  items: [{ id: "b1", name: "Software", issues: 2, steps: [{ id: "s1", name: "To do", issues: 3 }, { id: "s2", name: "Doing", issues: 1 }] }],
};

const hub = (access: (name: string) => unknown) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency: string, name: string) => (name === taskTools.backlogs ? backlogs : access(name)) as never);

beforeEach(() => vi.restoreAllMocks());

describe("a backlog's page", () => {
  it("never shows a negative count of issues at no step", async () => {
    hub(() => ({ owner_group: "", groups: [] }));
    expect((await mcpBacklogPageClient.page("b1"))?.noStep).toBe(0);
  });

  it("puts the access of each group in the words of the screen", async () => {
    hub((name) => (name === accessTools.list ? { owner_group: "po", groups: [{ group_id: "core", level: "move" }] } : { items: [{ id: "po", name: "Product owner" }, { id: "core", name: "Core team" }] }));
    const page = await mcpBacklogPageClient.page("b1");
    expect(page?.access).toEqual({ restricted: true, groups: [{ name: "Product owner", level: "Can edit" }, { name: "Core team", level: "Can move" }] });
  });

  it("leaves the access out when the hub refuses to read it, and keeps the steps", async () => {
    hub(() => {
      throw new mcp.McpError("access_list: not allowed");
    });
    const page = await mcpBacklogPageClient.page("b1");
    expect(page?.access).toBeUndefined();
    expect(page?.steps).toEqual([{ name: "To do", issues: 3 }, { name: "Doing", issues: 1 }]);
  });

  it("is not there for a backlog the hub does not list", async () => {
    hub(() => ({}));
    expect(await mcpBacklogPageClient.page("nope")).toBeUndefined();
  });
});

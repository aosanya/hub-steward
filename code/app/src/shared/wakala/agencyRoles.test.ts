import { afterEach, describe, expect, it, vi } from "vitest";
import { listAgencyRoles, roleKey } from "./agencyRoles";
import * as mcp from "./mcp";

afterEach(() => vi.restoreAllMocks());

const publications = {
  items: [
    { channel: "production", version: 2, draft_id: "d2" },
    { channel: "production", version: 5, draft_id: "d5" },
    { channel: "preview", version: 9, draft_id: "d9" },
  ],
};

describe("the roles of the live agency", () => {
  it("reads the roles of the newest production draft with their id, code and name", async () => {
    const call = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string) =>
      (tool === "agency_list_publications" ? publications : { items: [{ id: "r1", code: "product-owner", name: "Product owner" }, { id: "r2", name: "Council" }] }) as never,
    );
    expect(await listAgencyRoles()).toEqual([
      { id: "r1", code: "product-owner", name: "Product owner" },
      { id: "r2", code: "", name: "Council" },
    ]);
    expect(call).toHaveBeenCalledWith("", "agency_list_roles", { draft_id: "d5" });
  });

  it("lists no roles when nothing is published", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [] } as never);
    expect(await listAgencyRoles()).toEqual([]);
  });

  it("names a role by its code, or its id when it has no code, as the hub matches them", () => {
    expect(roleKey({ id: "r1", code: "product-owner", name: "Product owner" })).toBe("product-owner");
    expect(roleKey({ id: "r2", code: "", name: "Council" })).toBe("r2");
  });
});

import { vi } from "vitest";
import * as mcp from "../../shared/wakala/mcp";
import { groupsOfType } from "./groupsOfType";

const groups = [
  { id: "g1", name: "Audit Committee", node_type: "Committee" },
  { id: "g2", name: "Public Works", node_type: "Department" },
  { id: "g3", name: "Balogh household", node_type: "Háztartás" },
  { id: "g4", name: "walk-03 Town hall" },
  { id: "g5", name: "Planning Committee", node_type: "committee" },
];

afterEach(() => vi.restoreAllMocks());

describe("groupsOfType", () => {
  it("keeps only the groups whose type is the one asked for, without regard to case", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: groups });

    expect((await groupsOfType("Committee")).map((group) => group.id)).toEqual(["g1", "g5"]);
  });

  it("asks the hub once, through actor_list_groups", async () => {
    const called = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: groups });

    await groupsOfType("Department");

    expect(called).toHaveBeenCalledTimes(1);
    expect(called).toHaveBeenCalledWith("", "actor_list_groups");
  });

  it("returns nothing when no group carries the type", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: groups });

    expect(await groupsOfType("Crew")).toEqual([]);
  });
});

import { vi } from "vitest";
import * as mcp from "../../shared/wakala/mcp";
import { goneRoleWords, loadRoleKinds, openRoleChoices, roleKindName, roleNamesOf } from "./roleKinds";

const kinds = [
  { id: "k-fin", name: "Finance officer", definition_role_id: "R-4" },
  { id: "k-chair", name: "Chair", leads_group: true },
  { id: "k-old", name: "Old clerk", retired_at: "2026-01-01T00:00:00Z" },
  { id: "k-blank", name: "" },
];

afterEach(() => vi.restoreAllMocks());

describe("loadRoleKinds", () => {
  it("asks the hub once, through actor_list_role_kinds, and keeps what the screens read of each kind", async () => {
    const called = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: kinds });

    const loaded = await loadRoleKinds();

    expect(called).toHaveBeenCalledTimes(1);
    expect(called).toHaveBeenCalledWith("", "actor_list_role_kinds");
    expect(loaded.map((kind) => kind.id)).toEqual(["k-fin", "k-chair", "k-old", "k-blank"]);
    expect(loaded[0]).toMatchObject({ name: "Finance officer", retired: false, leadsGroup: false, definitionRoleId: "R-4" });
    expect(loaded[1]).toMatchObject({ leadsGroup: true });
    expect(loaded[2]).toMatchObject({ retired: true });
  });

  it("lets a failed read fail, so the caller can say it could not be loaded", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new Error("down"));

    await expect(loadRoleKinds()).rejects.toThrow("down");
  });
});

describe("roleKindName", () => {
  it("names a known kind by its name", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: kinds });

    expect(roleKindName(await loadRoleKinds(), "k-fin")).toBe("Finance officer");
  });

  it("calls an unknown, blank or empty id a role that no longer exists, never the id", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: kinds });
    const loaded = await loadRoleKinds();

    expect(goneRoleWords).toBe("a role that no longer exists");
    expect(roleKindName(loaded, "k-missing-4821")).toBe(goneRoleWords);
    expect(roleKindName(loaded, "")).toBe(goneRoleWords);
    expect(roleKindName(loaded, "k-blank")).toBe(goneRoleWords);
  });

  it("still names a retired kind, because people hold seats of it", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: kinds });

    expect(roleKindName(await loadRoleKinds(), "k-old")).toBe("Old clerk");
  });
});

describe("roleNamesOf and openRoleChoices", () => {
  it("maps every kind id to its name", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: kinds });

    expect(roleNamesOf(await loadRoleKinds()).get("k-chair")).toBe("Chair");
  });

  it("offers only the named kinds still in use", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: kinds });

    expect(openRoleChoices(await loadRoleKinds())).toEqual([
      { value: "k-fin", label: "Finance officer" },
      { value: "k-chair", label: "Chair" },
    ]);
  });
});

describe("one place reads the role kinds", () => {
  const sources = import.meta.glob("../../**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

  it("is the only source file that calls actor_list_role_kinds", () => {
    const readers = Object.entries(sources)
      .filter(([path]) => !/\.test\.tsx?$/.test(path))
      .filter(([, source]) => source.includes("actor_list_role_kinds"))
      .map(([path]) => path.replace(/^(\.{1,2}\/)+/, ""));

    expect(readers.map((path) => path.split("/").pop())).toEqual(["roleKinds.ts"]);
  });
});

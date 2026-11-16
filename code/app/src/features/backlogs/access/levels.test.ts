import { describe, expect, it } from "vitest";
import { groupsOfOwnerHierarchy, groupsWithoutAccess, levelItems, levelWords, smartLevelItems, withGroup, withLevel, withoutGroup } from "./levels";
import type { AccessRow, AgencyGroup } from "./types";

const groups: AgencyGroup[] = [
  { id: "po", name: "Product owner", hierarchyId: "h1" },
  { id: "core", name: "Core team", hierarchyId: "h1" },
  { id: "other", name: "Other", hierarchyId: "h2" },
  { id: "loose", name: "Loose", hierarchyId: "" },
];

const owner: AccessRow = { groupId: "po", name: "Product owner", level: "edit", fixed: true, roleName: "", roleTooSmall: false };
const core: AccessRow = { groupId: "core", name: "Core team", level: "see", fixed: false, roleName: "Backlog member", roleTooSmall: false };

describe("levels", () => {
  it("words each level as the screen shows it, and nothing for an unknown one", () => {
    expect(levelItems.map((item) => levelWords(item.id))).toEqual(["Can see", "Can move", "Can edit"]);
    expect(levelWords("none" as never)).toBe("");
  });

  it("leaves Can move out of the levels of a smart backlog", () => {
    expect(smartLevelItems.map((item) => item.label)).toEqual(["Can see", "Can edit"]);
  });
});

describe("groups a backlog can be shared with", () => {
  it("keeps the groups of the owner group's hierarchy", () => {
    expect(groupsOfOwnerHierarchy(groups, "po").map((group) => group.id)).toEqual(["po", "core"]);
  });

  it("keeps every group when the owner group is unknown or has no hierarchy", () => {
    expect(groupsOfOwnerHierarchy(groups, "gone")).toEqual(groups);
    expect(groupsOfOwnerHierarchy(groups, "loose")).toEqual(groups);
    expect(groupsOfOwnerHierarchy(groups, "")).toEqual(groups);
  });

  it("offers only the groups that have no row yet", () => {
    expect(groupsWithoutAccess(groups, [owner, core]).map((group) => group.id)).toEqual(["other", "loose"]);
    expect(groupsWithoutAccess(groups, [])).toEqual(groups);
  });
});

describe("editing the rows", () => {
  it("changes the level of one group and never of the fixed owner row", () => {
    expect(withLevel([owner, core], "core", "move")).toEqual([owner, { ...core, level: "move" }]);
    expect(withLevel([owner, core], "po", "see")).toEqual([owner, core]);
  });

  it("adds a group at Can see with no role yet", () => {
    expect(withGroup([owner], groups[1])).toEqual([owner, { groupId: "core", name: "Core team", level: "see", fixed: false, roleName: "", roleTooSmall: false }]);
  });

  it("takes a group away, but never the fixed owner row", () => {
    expect(withoutGroup([owner, core], "core")).toEqual([owner]);
    expect(withoutGroup([owner, core], "po")).toEqual([owner, core]);
  });
});

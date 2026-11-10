import { describe, expect, it } from "vitest";
import { actorChoices } from "./actorChoices";
import { namesForRole } from "./namesForRole";
import { reportPath, resultKind, testPath } from "./paths";

describe("the test page's addresses", () => {
  it("opens the plain test page with no parameters", () => {
    expect(testPath("h1")).toBe("/h/h1/test");
  });

  it("adds the parameters as a query, encoded", () => {
    expect(testPath("h 1", { run: "r 1", mode: "a&b" })).toBe("/h/h%201/test?run=r+1&mode=a%26b");
  });

  it("opens a run's report", () => {
    expect(reportPath("h1", "r9")).toBe("/h/h1/test?run=r9&report=1");
  });
});

describe("the colour a run result gets", () => {
  it.each([
    ["passed", "ok"],
    ["failed", "bad"],
    ["stopped", "warn"],
    ["running", "use"],
    ["queued", "mute"],
    ["", "mute"],
  ])("%s is %s", (result, kind) => {
    expect(resultKind(result)).toBe(kind);
  });
});

describe("the roles an actor can take in a scenario", () => {
  const choices = {
    workflows: [],
    roles: [{ id: "r1", name: "Clerk" }],
    groups: [
      { id: "g1", name: "Board", parentId: "" },
      { id: "g2", name: "Staff", parentId: "g1" },
    ],
  };

  it("lists the roles alone while no actor takes a group", () => {
    expect(actorChoices(choices, [{ name: "Amina", roleId: "r1" }])).toEqual([{ id: "r1", name: "Clerk" }]);
  });

  it("adds a group once an actor holds it, dropping its parent link", () => {
    expect(actorChoices(choices, [{ name: "Otieno", roleId: "g2" }])).toEqual([
      { id: "r1", name: "Clerk" },
      { id: "g2", name: "Staff" },
    ]);
  });
});

describe("the names a role is played by in a scenario", () => {
  const roles = [
    { id: "r1", name: "Clerk" },
    { id: "r2", name: "Clerk" },
    { id: "r3", name: "Auditor" },
  ];

  it("lists built-in actors first, then the scenario's own, for every role of that name", () => {
    const builtIn = [{ name: "Bot", roleName: "Clerk" }, { name: "Other", roleName: "Auditor" }];
    const actors = [{ name: "Amina", roleId: "r1" }, { name: "Juma", roleId: "r2" }, { name: "Zed", roleId: "r3" }];
    expect(namesForRole("Clerk", roles, builtIn, actors)).toEqual(["Bot", "Amina", "Juma"]);
  });

  it("leaves out an actor with no name", () => {
    expect(namesForRole("Clerk", roles, [], [{ name: "", roleId: "r1" }, { name: "Amina", roleId: "r1" }])).toEqual(["Amina"]);
  });

  it("answers with the role's own name when nobody plays it", () => {
    expect(namesForRole("Auditor", roles, [], [])).toEqual(["Auditor"]);
  });

  it("answers with every group's name when the role is a group", () => {
    const groups = [{ id: "g1", name: "Board", parentId: "" }, { id: "g2", name: "Staff", parentId: "g1" }];
    expect(namesForRole("Staff", roles, [], [], groups)).toEqual(["Board", "Staff"]);
  });

  it("prefers a role over a group of the same name", () => {
    const groups = [{ id: "g1", name: "Clerk", parentId: "" }];
    expect(namesForRole("Clerk", roles, [], [{ name: "Amina", roleId: "r1" }], groups)).toEqual(["Amina"]);
  });
});

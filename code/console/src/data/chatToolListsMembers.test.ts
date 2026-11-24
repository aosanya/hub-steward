import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { inFamily, toolFamilyOf } from "./chatTools";

vi.mock("./features", () => ({
  measuresOn: true,
  withoutMeasuresOff: (tools: string[]) => tools,
}));

const retiredTool = "actor_list_actors";

const listFiles = [
  "chatTools.ts",
  ...readdirSync(join(__dirname, "chatPages"))
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => join("chatPages", file)),
];

const namingLines = (file: string): string[] =>
  readFileSync(join(__dirname, file), "utf8")
    .split("\n")
    .flatMap((line, index) =>
      line.includes(`"${retiredTool}"`) ? [`${file}:${index + 1}`] : [],
    );

it("names actor_list_actors in no chat tool list, since hub agents no longer list members", () => {
  expect(listFiles.flatMap(namingLines)).toEqual([]);
});

const peoplePages = ["users", "groups"];

const everyPage = [
  ...peoplePages,
  "status",
  "profile",
  "goals",
  "roles",
  "general",
  "agents",
  "models",
  "approvals",
  "operations",
  "network",
  "activity",
  "alerts",
  "documents",
  "farm-orders",
  "produce",
  "equipment",
  "unlisted-page",
];

it("offers actor_list_actors to no chat page through any rule", () => {
  const offeringPages = everyPage.filter((page) =>
    inFamily(retiredTool, toolFamilyOf(page)),
  );
  expect(offeringPages).toEqual([]);
});

it("still offers the users and groups pages every other actor tool, including actor_list_actors_for_group", () => {
  for (const page of peoplePages) {
    for (const tool of [
      "actor_list_actors_for_group",
      "actor_list_groups",
      "actor_get_actor",
      "actor_get_group",
    ]) {
      expect(inFamily(tool, toolFamilyOf(page))).toBe(true);
    }
  }
});

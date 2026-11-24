import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

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

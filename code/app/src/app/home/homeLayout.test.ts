import { describe, expect, it } from "vitest";
import { nodeOf, type HomeNode } from "./homeDeclaration";
import { homeLayout, toolsKey } from "./homeLayout";

const section = (key: string, entries: HomeNode[] = []) => nodeOf({ key, title: key, entries });

const entry = (key: string, type: string) => nodeOf({ key, title: key, target: { type } });

const keys = (nodes: HomeNode[]) => nodes.map((node) => node.key);

describe("the layout of an agency's Home", () => {
  it("puts Tools after the declared sections", () => {
    expect(keys(homeLayout([section("win"), section("deliver")]))).toEqual(["win", "deliver", toolsKey]);
  });

  it("puts Tools before Settings so Settings stays last", () => {
    expect(keys(homeLayout([section("win"), section("settings"), section("deliver")]))).toEqual(["win", "deliver", toolsKey, "settings"]);
  });

  it("gives Tools the Backlogs row and then the Files row, in that order", () => {
    const tools = homeLayout([section("win")]).find((node) => node.key === toolsKey);
    expect(tools?.target).toBeNull();
    expect(tools?.entries.map((node) => [node.key, node.target?.type])).toEqual([
      ["backlogs", "backlogs"],
      ["files", "files"],
    ]);
  });

  it("names Tools and its rows in English, Swahili and Hungarian", () => {
    const tools = homeLayout([section("win")]).find((node) => node.key === toolsKey)!;
    expect([tools.title, tools.titles.sw, tools.titles.hu]).toEqual(["Tools", "Zana", "Eszközök"]);
    expect(tools.entries.map((node) => node.title)).toEqual(["Backlogs", "Files"]);
    expect(tools.entries.map((node) => node.titles.sw)).toEqual(["Orodha za kazi", "Faili"]);
    expect(tools.entries.map((node) => node.titles.hu)).toEqual(["Feladatlisták", "Fájlok"]);
  });

  it("leaves out a Start or Ongoing entry at the top and inside a section", () => {
    const declared = [entry("start", "start"), section("win", [entry("ongoing", "ongoing"), entry("visit", "workflow")]), entry("ongoing", "ongoing")];
    const laid = homeLayout(declared);
    expect(keys(laid)).toEqual(["win", toolsKey]);
    expect(keys(laid[0].entries)).toEqual(["visit"]);
  });

  it("adds no second Tools when the agency declares a section of that key", () => {
    expect(keys(homeLayout([section("win"), section(toolsKey)]))).toEqual(["win", toolsKey]);
  });

  it("is Tools alone for an agency that declares nothing", () => {
    expect(keys(homeLayout([]))).toEqual([toolsKey]);
  });
});

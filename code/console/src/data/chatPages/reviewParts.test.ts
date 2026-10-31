import { describe, expect, it } from "vitest";
import { suggestToolsOf, toolFamilyOf, writeToolsOf } from "../chatTools";
import { chatPageOf } from "./index";

const sections: Record<string, string> = {
  "review-profile": "profile",
  "review-goals": "goals",
  "review-objectives": "objectives",
  "review-roles": "roles",
  "review-workflows": "workflows",
  "review-risks": "bowties",
  "review-tests": "test",
};

describe.each(Object.entries(sections))("%s chat", (page, section) => {
  it("reads and writes like the %s page", () => {
    expect(toolFamilyOf(page)).toEqual(toolFamilyOf(section));
    expect(writeToolsOf(page)).toEqual(writeToolsOf(section));
  });

  it("opens no suggestions tab of its own", () => {
    expect(suggestToolsOf(page)).toEqual([]);
  });
});

describe("review-objectives chat", () => {
  it("can create an objective", () => {
    expect(writeToolsOf("review-objectives")).toContain("agency_create_objective");
    expect(chatPageOf("review-objectives")).not.toBeNull();
  });
});

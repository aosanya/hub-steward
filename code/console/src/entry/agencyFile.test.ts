import { describe, expect, it } from "vitest";
import { readAgency } from "./agencyFile";

const good = { agency: { name: " Nyando Co-op " }, roles: [1, 2], goals: [1], workflows: [1, 2, 3] };

describe("reading an agency file", () => {
  it("counts the roles, goals and workflows and trims the agency name", () => {
    expect(readAgency(JSON.stringify(good))).toEqual({ document: good, name: "Nyando Co-op", roles: 2, goals: 1, workflows: 3 });
  });

  it("accepts an agency with no name", () => {
    expect(readAgency(JSON.stringify({ ...good, agency: {} }))?.name).toBe("");
  });

  it.each([
    ["text that is not JSON", "nope"],
    ["an array", "[]"],
    ["null", "null"],
    ["no agency", JSON.stringify({ ...good, agency: undefined })],
    ["an agency that is a list", JSON.stringify({ ...good, agency: [] })],
    ["no roles", JSON.stringify({ ...good, roles: undefined })],
    ["goals that are not a list", JSON.stringify({ ...good, goals: {} })],
    ["no workflows", JSON.stringify({ ...good, workflows: "x" })],
  ])("rejects %s", (_, text) => {
    expect(readAgency(text)).toBeNull();
  });
});

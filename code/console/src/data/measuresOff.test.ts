import { describe, expect, it } from "vitest";
import { chatPageOf } from "./chatPages";
import { measuresOn, withoutMeasuresOff } from "./features";

const measureTools = (names: string[]) =>
  names.filter((name) => name.includes("measure"));

describe("measures while they are switched off", () => {
  it("are off", () => {
    expect(measuresOn).toBe(false);
  });

  it("leave the measure tools out of what any page's chat can read, write or suggest", () => {
    for (const page of [
      "goals",
      "objectives",
      "roles",
      "risks",
      "modules",
      "workflows",
      "test",
      "profile",
      "publish",
    ]) {
      const chat = chatPageOf(page);
      expect(
        measureTools([
          ...(chat?.reads ?? []),
          ...(chat?.writes ?? []),
          ...(chat?.suggests ?? []),
        ]),
        page,
      ).toEqual([]);
    }
  });

  it("still leave the other tools of the Objectives chat", () => {
    const chat = chatPageOf("objectives");

    expect(chat?.reads).toContain("agency_list_objectives");
    expect(chat?.writes).toEqual(
      expect.arrayContaining(["agency_create_objective", "agency_link_workflow_objective"]),
    );
    expect(chat?.suggests).toContain("agency_delete_objective");
  });

  it("drop only tools named for a measure", () => {
    expect(
      withoutMeasuresOff([
        "agency_list_measures",
        "agency_set_measure",
        "agency_list_goals",
      ]),
    ).toEqual(["agency_list_goals"]);
  });
});

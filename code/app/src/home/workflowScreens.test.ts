import { forgetOpenAgency, openAgency } from "../agency/open";
import {
  applySupplierPath,
  applySupplierWorkflow,
  hasScreen,
  joinGroupPath,
  joinGroupWorkflow,
  screenOf,
  workflowScreens,
} from "./workflowScreens";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

describe("the screen a workflow step opens", () => {
  it.each([
    [joinGroupWorkflow, "/a/farmers/join"],
    [applySupplierWorkflow, "/supply/apply"],
  ])("sends the %s step to %s", (formName, path) => {
    expect(screenOf({ formName })).toBe(path);
  });

  it("holds exactly the two workflows that have a screen of their own", () => {
    expect([...workflowScreens.keys()]).toEqual(["Join a group", "Apply as a supplier"]);
  });

  it.each(["Urea group order", "Problem report", "", "join a group", "Join a group ", "constructor", "toString", "__proto__"])(
    "sends the step of form %j nowhere, since it has no screen of its own",
    (formName) => {
      expect(screenOf({ formName })).toBeUndefined();
    },
  );

  it.each([joinGroupWorkflow, applySupplierWorkflow, "Problem report", ""])("agrees with hasScreen on the step of form %j", (formName) => {
    expect(hasScreen({ formName })).toBe(screenOf({ formName }) !== undefined);
  });

  it("names the two workflows and their paths once", () => {
    expect([joinGroupWorkflow, joinGroupPath(), applySupplierWorkflow, applySupplierPath]).toEqual([
      "Join a group",
      "/a/farmers/join",
      "Apply as a supplier",
      "/supply/apply",
    ]);
    expect(workflowScreens.get(joinGroupWorkflow)?.()).toBe(joinGroupPath());
    expect(workflowScreens.get(applySupplierWorkflow)?.()).toBe(applySupplierPath);
  });

  it("builds the Join a group path in the agency open at the time it is asked", () => {
    openAgency("riders");
    expect(screenOf({ formName: joinGroupWorkflow })).toBe("/a/riders/join");
  });
});

describe("whether a workflow step has a screen of its own", () => {
  it.each([joinGroupWorkflow, applySupplierWorkflow])("says the %s step has one", (formName) => {
    expect(hasScreen({ formName })).toBe(true);
  });

  it.each(["Urea group order", "Problem report", "", "join a group", "Join a group ", "constructor", "toString", "__proto__"])(
    "says the step of form %j has none",
    (formName) => {
      expect(hasScreen({ formName })).toBe(false);
    },
  );
});

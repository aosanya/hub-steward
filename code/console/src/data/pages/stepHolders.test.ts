import { expect, test } from "vitest";
import { holderNames, holdersOf, roleHoldsStep, type HoldingField } from "./stepHolders";

const required = (code: string): HoldingField => ({ code, required: true });
const optional = (code: string): HoldingField => ({ code, required: false });

test("the add step needs add.* or an add code for every required field", () => {
  const fields = [required("title"), required("closing_date"), optional("note")];

  expect(roleHoldsStep("tender", fields, "add", ["record.tender.add.*"])).toBe(true);
  expect(roleHoldsStep("tender", fields, "add", ["record.tender.add.title", "record.tender.add.closing_date"])).toBe(true);
  expect(roleHoldsStep("tender", fields, "add", ["record.tender.add.title", "record.tender.add.note"])).toBe(false);
  expect(roleHoldsStep("tender", fields, "add", ["record.tender.edit.*", "record.other.add.*"])).toBe(false);
});

test("a required field with no code cannot be carried, so only add.* holds the add step", () => {
  const fields = [required(""), required("title")];

  expect(roleHoldsStep("tender", fields, "add", ["record.tender.add.title"])).toBe(false);
  expect(roleHoldsStep("tender", fields, "add", ["record.tender.add.*"])).toBe(true);
});

test("with no required field the add step is held by add.* or any one add field", () => {
  const fields = [optional("title"), optional("note")];

  expect(roleHoldsStep("tender", fields, "add", ["record.tender.add.note"])).toBe(true);
  expect(roleHoldsStep("tender", fields, "add", ["record.tender.add.colour"])).toBe(false);
  expect(roleHoldsStep("tender", [], "add", ["record.tender.add.*"])).toBe(true);
});

test("the edit step is held by edit.* or any one edit field, and the delete step by the delete code", () => {
  const fields = [required("title")];

  expect(roleHoldsStep("tender", fields, "edit", ["record.tender.edit.*"])).toBe(true);
  expect(roleHoldsStep("tender", fields, "edit", ["record.tender.edit.title"])).toBe(true);
  expect(roleHoldsStep("tender", fields, "edit", ["record.tender.add.title"])).toBe(false);
  expect(roleHoldsStep("tender", fields, "delete", ["record.tender.delete"])).toBe(true);
  expect(roleHoldsStep("tender", fields, "delete", ["record.tender.delete.title"])).toBe(false);
});

test("the holders are the names of the roles that hold the step, in the order given", () => {
  const roles = [
    { name: "First", permissions: ["record.tender.delete"] },
    { name: "Second", permissions: [] },
    { name: "Third", permissions: ["record.tender.delete"] },
  ];

  expect(holdersOf("tender", [], "delete", roles)).toEqual(["First", "Third"]);
  expect(holderNames(["First", "Third"])).toBe("First, Third");
  expect(holderNames([])).toBe("");
});

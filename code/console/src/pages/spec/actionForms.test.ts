import { describe, expect, it } from "vitest";
import { actionForms, isActionFormId, secondaryFormsOf, type ActionFormId } from "./actionForms";

describe("action forms", () => {
  it.each(Object.keys(actionForms) as ActionFormId[])("%s is known and draws a tool or lists fields", (id) => {
    expect(isActionFormId(id)).toBe(true);
    const form = actionForms[id];
    expect(form.action).toBe(id);
    expect(Boolean(form.drawing) || (form.fields?.length ?? 0) > 0).toBe(true);
  });

  it.each(["constructor", "toString", "__proto__", "hasOwnProperty", "nope", ""])("does not know %j", (id) => {
    expect(isActionFormId(id)).toBe(false);
  });

  it("gives the pages with a second form its list", () => {
    expect(secondaryFormsOf("general")).toEqual([{ form: "language", label: "setDefaultLanguage" }]);
    expect(secondaryFormsOf("profile")).toEqual([{ form: "hubname", label: "renameHub" }]);
    expect(secondaryFormsOf("goals")).toEqual([{ form: "objectives", label: "addObjective" }]);
  });

  it.each(["roles", "constructor", "__proto__", "toString"])("gives %s no second form", (page) => {
    expect(secondaryFormsOf(page)).toEqual([]);
  });

  it("points every second form at a known form", () => {
    for (const page of ["general", "profile", "goals"]) {
      for (const { form } of secondaryFormsOf(page)) expect(isActionFormId(form)).toBe(true);
    }
  });

  it("makes the document form require a title and text", () => {
    const required = (actionForms.documents.fields ?? []).filter((f) => f.required).map((f) => f.name);
    expect(required).toEqual(["title", "text"]);
  });
});

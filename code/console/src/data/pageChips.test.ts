import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hintKeys } from "./menu";

const translations: Record<string, Record<string, string>> = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const english = (key: string) => translations.en[key];

describe("the chat chips of the workflow edit pages", () => {
  it("are their own, not the chips of the Workflows page", () => {
    expect(hintKeys("workflow-edit", true, { step: "Send" })).not.toEqual(hintKeys("workflows"));
  });

  it("offer Add a cancel workflow and Add a step after the last step, as drawn", () => {
    const chips = hintKeys("workflow-edit", true, { step: "Send" }).map(english);

    expect(chips).toEqual(["Add a cancel workflow", "Add a step after {step}"]);
  });

  it("offer only Add a cancel workflow while the workflow has no step to follow", () => {
    expect(hintKeys("workflow-edit", true, {}).map(english)).toEqual(["Add a cancel workflow"]);
    expect(hintKeys("workflow-edit").map(english)).toEqual(["Add a cancel workflow"]);
  });

  it("do not change the chips of the Workflows page", () => {
    expect(hintKeys("workflows", true, { step: "Send" }).map(english)).toEqual(["Show the workflows", "Add a cancel workflow", "What is not published?"]);
  });

  it("are in the seven languages, the step chip naming where the step goes", () => {
    const keys = hintKeys("workflow-edit", true, { step: "Send" });

    for (const language of ["en", "de", "sw", "es", "fr", "zh", "hu"]) {
      for (const key of keys) expect(translations[language][key], `${language} lacks ${key}`).toBeTruthy();
      expect(translations[language][keys[1]], `${language} step chip`).toContain("{step}");
    }
  });
});

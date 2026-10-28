import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { templateOf, templates } from "./templates";

const bundle = resolve(__dirname, "../../public/templates");

const bundled = (id: string) => JSON.parse(readFileSync(join(bundle, `${id}.json`), "utf8")) as { roles: unknown[]; goals: unknown[] };

describe("the templates the create page offers", () => {
  it("are exactly the files in the bundle's templates folder", () => {
    const files = readdirSync(bundle)
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.replace(/\.json$/, ""))
      .sort();
    expect(templates.map((template) => template.id).sort()).toEqual(files);
  });

  it("count the roles and the goals their file holds", () => {
    for (const template of templates) {
      const file = bundled(template.id);
      expect([template.id, template.roles, template.goals]).toEqual([template.id, file.roles.length, file.goals.length]);
    }
  });

  it("each name their modules, switch at least one on, and carry no other module list than the objective links", () => {
    for (const template of templates) {
      const file = JSON.parse(readFileSync(join(bundle, `${template.id}.json`), "utf8")) as { modules: { code: string; enabled: boolean }[] };
      const moduleKeys = Object.keys(file).filter((key) => key.includes("module"));
      expect([template.id, moduleKeys.filter((key) => key !== "objective_modules")]).toEqual([template.id, ["modules"]]);
      expect(file.modules.some((module) => module.enabled)).toBe(true);
    }
  });

  it("each carry a word and an icon of their own", () => {
    expect(new Set(templates.map((template) => template.nameKey)).size).toBe(templates.length);
    expect(new Set(templates.map((template) => template.icon)).size).toBe(templates.length);
  });

  it("fall back to the first template for an id the bundle does not hold", () => {
    expect(templateOf("farmers").id).toBe("farmers");
    expect(templateOf("elsewhere")).toBe(templates[0]);
  });
});

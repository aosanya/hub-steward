import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Rec = Record<string, any>;

const read = (path: string) => JSON.parse(readFileSync(resolve(__dirname, path), "utf8")) as Record<string, Rec[]>;

const demo = read("../../../../demo/municipality.json");

const catalog = JSON.parse(readFileSync(resolve(__dirname, "../../../wakala-api/modules/agency/models/modules_catalog.json"), "utf8")) as Rec[];
const permissions = JSON.parse(readFileSync(resolve(__dirname, "../../../wakala-api/modules/agency/models/permissions_catalog.json"), "utf8")) as Rec[];

const departmentHead = (file: Record<string, Rec[]>) => file.roles.find((role) => role.code === "R-13") as Rec;
const council = (file: Record<string, Rec[]>) => file.roles.find((role) => role.code === "R-14") as Rec;
const ruleFor = (file: Record<string, Rec[]>, role: Rec) => {
  const attachment = file.rule_attachments.find((entry) => entry.target_type === "role" && entry.target_code === role.code) as Rec;
  return file.rules.find((rule) => rule.code === attachment.rule_code) as Rec;
};

describe("the municipality agency switches on the risk module", () => {
  it("mounts riskmanager once, enabled and unlocked, as a module the catalog can mount", () => {
    const mounts = demo.modules.filter((module) => module.code === "riskmanager");
    expect(mounts).toHaveLength(1);
    expect(mounts[0]).toMatchObject({ enabled: true, locked: false, deleted: false });
    expect(catalog.find((module) => module.code === "riskmanager")).toMatchObject({ mountable: true, locked: false });
  });

  it("gives the department head the risk.read permission and a rule that limits them to their own service", () => {
    const role = departmentHead(demo);
    expect(role.name).toBe("Osztályvezető (kockázat felelőse)");
    expect(role.permissions).toEqual(["risk.read"]);
    expect(ruleFor(demo, role).text).toMatch(/csak a saját szolgáltatásának kockázatait látja/);
    expect(ruleFor(demo, role).text).toMatch(/osztályvezetője/);
  });

  it("gives the council role the same read-only permission and a rule that opens the whole register", () => {
    const role = council(demo);
    expect(role.name).toBe("Testületi kockázatolvasó");
    expect(role.permissions).toEqual(["risk.read"]);
    expect(ruleFor(demo, role).text).toMatch(/teljes kockázati nyilvántartást olvassa/);
    expect(ruleFor(demo, role).text).not.toMatch(/saját szolgáltatás/);
  });

  it("names only a permission the catalog holds, owned by the riskmanager module, and grants nothing that writes", () => {
    const entry = permissions.find((permission) => permission.code === "risk.read") as Rec;
    expect(entry.module).toBe("riskmanager");
    for (const role of [departmentHead(demo), council(demo)]) {
      expect(role.permissions.every((code: string) => permissions.some((permission) => permission.code === code))).toBe(true);
      expect(entry.actions.every((action: string) => /\.(list|read|bowtie|reliance)$/.test(action))).toBe(true);
    }
  });
});

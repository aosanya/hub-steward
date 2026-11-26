import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency } from "../../../shared/wakala/openAgency";
import type { FilesClient } from "../../files";
import { RecordPage } from "./RecordPage";
import { RulebookPage } from "./RulebookPage";
import { arrive, at, backlogsClient, clientOf, file, issue, opened, ready, rule } from "./rulebookFixture";

vi.mock("../../../shared/wakala/mcp", async () => {
  const actual = await vi.importActual<typeof import("../../../shared/wakala/mcp")>("../../../shared/wakala/mcp");
  return { ...actual, callTool: async () => ({ items: [] }) };
});

beforeEach(arrive);

afterEach(() => {
  cleanup();
  forgetOpenAgency();
});

const css = readFileSync(resolve(__dirname, "rulebook.css"), "utf8");

const wide = css.slice(css.indexOf("@media (min-width: 48rem)"));

const files = { folders: async () => [] } as unknown as FilesClient;

describe("the rulebook styles", () => {
  it("sets no font size in pixels and no base size of its own", () => {
    expect(css).not.toMatch(/font-size:\s*[\d.]+px/);
    expect(css).not.toMatch(/font:\s*[^;]*\d+px/);
    expect(css).not.toMatch(/:root|html\s*\{/);
  });

  it("gives every button font inherit and sizes in rem", () => {
    const buttons = css.match(/[^{}]*\bbutton\b[^{}]*\{[^}]*\}/g) ?? [];
    for (const block of buttons) expect(block).toContain("font: inherit");
    for (const size of css.match(/font-size:\s*[^;]+/g) ?? []) expect(size).toMatch(/rem/);
  });

  it("changes the layout in one min-width block", () => {
    expect(css.match(/@media \(min-width: 48rem\)/g)).toHaveLength(1);
  });

  it("reuses the shared table, chip and tag rules and copies none of them", () => {
    expect(css).not.toContain("border-collapse");
    expect(css).not.toMatch(/\.rule-statuses|\.rule-marks/);
    expect(css).not.toMatch(/\.rule-table th\s*\{|\.rule-table td\s*\{/);
    expect(css).not.toMatch(/\.issue-tags/);
  });

  it("imports the shared stylesheets where the shared classes are used", () => {
    const source = (name: string) => readFileSync(resolve(__dirname, name), "utf8");
    expect(source("RulesTable.tsx")).toContain("app/home/homeWindow.css");
    for (const name of ["RulesTable.tsx", "StatusChips.tsx", "RuleMarks.tsx", "CodeRow.tsx"]) expect(source(name)).toContain("../shared/backlogs.css");
  });

  it("sets no margin between rows", () => {
    expect(css).not.toMatch(/\.rule-table[^{]*\{[^}]*margin:\s*[^0]/);
  });

  it("stacks Status and Tags under the Title on a phone and sets them in columns on a wide window", () => {
    const phone = css.slice(0, css.indexOf("@media (min-width: 48rem)"));
    expect(phone).toMatch(/\.rule-table tr\s*\{[^}]*display:\s*grid/);
    expect(phone).toMatch(/grid-template-areas/);
    expect(wide).toMatch(/\.rule-table tr\s*\{[^}]*display:\s*table-row/);
  });
});

describe("the rulebook screens on a wide window at 1440 x 900", () => {
  it.each([["rule", "1 rule"], ["decision", "1 decision"], ["question", "1 question"]])("keeps the view switch a direct child of the body, after the search bar, for %s", async (kind, count) => {
    at(`/a/hub-1/backlogs/b1/rulebook?kind=${kind}`, "/a/:agencyId/backlogs/:backlogId/rulebook", <RulebookPage client={clientOf({ list: async () => ready([rule()]) })} backlogs={backlogsClient} />);
    await screen.findByText(count);
    const body = document.querySelector(".frame .body") as HTMLElement;
    const direct = Array.from(body.children).map((child) => child.className);
    expect(direct.indexOf("seg")).toBeGreaterThan(direct.indexOf("filter-bar"));
    expect(body.querySelector(":scope > .seg")).not.toBeNull();
  });

  it("fills the frame with the switch, the chips and the rows on one list", async () => {
    at("/a/hub-1/backlogs/b1/rulebook?kind=rule", "/a/:agencyId/backlogs/:backlogId/rulebook", <RulebookPage client={clientOf({ list: async () => ready([rule()]) })} backlogs={backlogsClient} />);
    await screen.findByText("1 rule");
    const body = document.querySelector(".frame .body") as HTMLElement;
    expect(body).not.toBeNull();
    const direct = Array.from(body.children).map((child) => child.className);
    expect(document.querySelector(".rule-table th")).not.toBeNull();
    expect(direct).toContain("seg");
    expect(body.querySelector(":scope > [role=group]")).not.toBeNull();
    expect(document.querySelector("table")?.classList.contains("home-rec")).toBe(true);
    expect(direct.some((name) => name.includes("rule-table"))).toBe(true);
    expect(direct).toContain("filter-bar");
    expect(body.querySelector(":scope > .filter-bar > .search-box")).not.toBeNull();
    expect(body.querySelector(":scope > .filter-bar > .sub")?.textContent).toBe("1 rule");
  });

  it("puts what the record is and why on the left, its references on the right", async () => {
    at(
      "/a/hub-1/backlogs/rule/R-2",
      "/a/:agencyId/backlogs/rule/:ruleCode",
      <RecordPage client={clientOf({ open: async () => ready(opened(rule({ code: "R-2", body: "Because." }), { files: [file()], issues: [issue("ISS-1", "One")] })) })} files={files} />,
    );
    await screen.findByText("Because.");
    const main = document.querySelector(".issue-main") as HTMLElement;
    const side = document.querySelector(".issue-side") as HTMLElement;
    expect(main.textContent).toContain("Because.");
    expect(main.textContent).toContain("In force");
    expect(side.textContent).toContain("References");
    expect(main.textContent).not.toContain("References");
  });
});

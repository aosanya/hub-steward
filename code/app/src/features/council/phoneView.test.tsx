import { act, cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { words } from "../../shared/language/words";
import type { Risk, RiskAction } from "../../features/risks/api";
import { CouncilRisksPage } from "./CouncilRisksPage";
import type { CouncilRisksClient } from "./councilRisksApi";
import { LateMattersPage } from "./LateMattersPage";
import type { LateMatter, LateMattersClient } from "./lateMattersApi";

const phoneWidth = 390;
const originalWidth = window.innerWidth;
const base = "/a/council-agency";

const resizeTo = (width: number) => {
  window.innerWidth = width;
  window.dispatchEvent(new Event("resize"));
};

beforeEach(() => {
  window.localStorage.clear();
  openAgency("council-agency");
  resizeTo(phoneWidth);
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  window.localStorage.clear();
  resizeTo(originalWidth);
});

const matters: LateMatter[] = [
  { id: "m1", title: "Broken streetlight", place: "Fo utca 4", raisedAt: "2026-10-01T08:00:00Z", daysLate: 12, owner: "Roads" },
  { id: "m2", title: "Blocked drain", place: "Kossuth utca 9", raisedAt: "2026-09-20T08:00:00Z", daysLate: 23, owner: "Water" },
];

const risks: Risk[] = [
  { id: "r1", title: "Boiler room fire", topEvent: "Fire", status: "open", owner: "officer-ilona" },
  { id: "r2", title: "Archive flood", topEvent: "Water", status: "accepted", owner: "officer-bence" },
];

const overdue: RiskAction[] = [
  { id: "a1", riskId: "r1", title: "Service the sprinklers", status: "open", dueAt: "2026-09-01T00:00:00Z", owner: "officer-ilona" },
];

const lateMattersClient: LateMattersClient = { list: async () => matters };
const councilRisksClient: CouncilRisksClient = { load: async () => ({ risks, overdueActions: overdue }) };

const showLateMatters = async () => {
  let container!: HTMLElement;
  await act(async () => {
    container = render(
      <MemoryRouter initialEntries={[`${base}/late-matters`]}>
        <Routes>
          <Route path={`${base}/late-matters`} element={<LateMattersPage client={lateMattersClient} />} />
        </Routes>
      </MemoryRouter>,
    ).container;
  });
  return container;
};

const showCouncilRisks = async () => {
  let container!: HTMLElement;
  await act(async () => {
    container = render(
      <MemoryRouter initialEntries={[`${base}/council-risks`]}>
        <Routes>
          <Route path={`${base}/council-risks`} element={<CouncilRisksPage client={councilRisksClient} />} />
        </Routes>
      </MemoryRouter>,
    ).container;
  });
  return container;
};

const rowOf = (title: string) => screen.getByText(title).closest(".row") as HTMLElement;

const buttonNames = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("button")).map((button) => button.getAttribute("aria-label") ?? button.textContent ?? "");

const councilSources = () => {
  const folder = resolve(__dirname);
  return readdirSync(folder)
    .filter((file) => /\.(css|tsx?)$/.test(file) && !file.endsWith(".test.tsx") && !file.endsWith(".test.ts"))
    .map((file) => ({ file, text: readFileSync(resolve(folder, file), "utf8") }));
};

describe("the late matters page with the window set to phone width (jsdom lays nothing out, so this checks content only)", () => {
  it("sets the window to 390 wide", async () => {
    await showLateMatters();
    expect(window.innerWidth).toBe(phoneWidth);
  });

  it("shows every row with its title, owner and days late", async () => {
    await showLateMatters();
    for (const matter of matters) {
      const row = rowOf(matter.title);
      expect(row).toHaveTextContent(matter.title);
      expect(row).toHaveTextContent(matter.owner);
      expect(row).toHaveTextContent(`${matter.daysLate} days late`);
    }
  });

  it("has no back button because the page passes no onBack to the Shell; the bar shows the title and the Menu button", async () => {
    const container = await showLateMatters();
    const bar = container.querySelector("header.bar") as HTMLElement;
    expect(within(bar).queryByRole("button", { name: "Back" })).toBeNull();
    expect(bar.querySelector(".back")).toBeNull();
    expect(within(bar).getByRole("heading", { name: words.lateMattersTitle })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Menu" })).toBeInTheDocument();
  });

  it("has only the Menu button and no input, textarea, select or form", async () => {
    const container = await showLateMatters();
    expect(buttonNames(container)).toEqual(["Menu"]);
    expect(container.querySelectorAll("input, textarea, select, form")).toHaveLength(0);
  });

  it("sets no font size or pixel width inline on any element", async () => {
    const container = await showLateMatters();
    container.querySelectorAll("[style]").forEach((element) => {
      const style = element.getAttribute("style") ?? "";
      expect(style).not.toMatch(/font-size/i);
      expect(style).not.toMatch(/(^|;)\s*width\s*:\s*[\d.]+px/i);
    });
  });
});

describe("the council risks page with the window set to phone width (jsdom lays nothing out, so this checks content only)", () => {
  it("sets the window to 390 wide", async () => {
    await showCouncilRisks();
    expect(window.innerWidth).toBe(phoneWidth);
  });

  it("shows every overdue action row with its title and owner", async () => {
    await showCouncilRisks();
    for (const item of overdue) {
      const row = rowOf(item.title);
      expect(row).toHaveTextContent(item.title);
      expect(row).toHaveTextContent(item.owner);
    }
  });

  it("shows every risk row with its title and owner", async () => {
    await showCouncilRisks();
    for (const item of risks) {
      const row = rowOf(item.title);
      expect(row).toHaveTextContent(item.title);
      expect(row).toHaveTextContent(item.owner);
    }
  });

  it("has no back button because the page passes no onBack to the Shell; the bar shows the title and the Menu button", async () => {
    const container = await showCouncilRisks();
    const bar = container.querySelector("header.bar") as HTMLElement;
    expect(within(bar).queryByRole("button", { name: "Back" })).toBeNull();
    expect(bar.querySelector(".back")).toBeNull();
    expect(within(bar).getByRole("heading", { name: words.councilRisksTitle })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Menu" })).toBeInTheDocument();
  });

  it("has only the Menu button and no input, textarea, select or form", async () => {
    const container = await showCouncilRisks();
    expect(buttonNames(container)).toEqual(["Menu"]);
    expect(container.querySelectorAll("input, textarea, select, form")).toHaveLength(0);
  });

  it("sets no font size or pixel width inline on any element", async () => {
    const container = await showCouncilRisks();
    container.querySelectorAll("[style]").forEach((element) => {
      const style = element.getAttribute("style") ?? "";
      expect(style).not.toMatch(/font-size/i);
      expect(style).not.toMatch(/(^|;)\s*width\s*:\s*[\d.]+px/i);
    });
  });
});

describe("the council folder's own sources", () => {
  it("holds no pixel font size and no inline font size", () => {
    const sources = councilSources();
    expect(sources.length).toBeGreaterThan(0);
    for (const { text } of sources) {
      expect(text).not.toMatch(/font-size\s*:\s*[\d.]+px/i);
      expect(text).not.toMatch(/fontSize\s*:/);
    }
  });

  it("holds no stylesheet of its own", () => {
    expect(readdirSync(resolve(__dirname)).filter((file) => file.endsWith(".css"))).toEqual([]);
  });
});

import { holdGroupIn } from "../../shared/testing/holdGroup";
import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, homeSegment, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import { CouncilRisksPage } from "../../features/council/CouncilRisksPage";
import type { CouncilRisksClient } from "../../features/council/councilRisksApi";
import { NeedsRole } from "../../features/backlogs";
import { GapsPage } from "../../features/risks/GapsPage";
import { RisksPage } from "../../features/risks/RisksPage";
import type { RisksClient } from "../../features/risks/api";
import { allScreens } from "../routes";
import type { AgencyScreen } from "../screen";
import { sectionHeads } from "./sectionHeads";
import { backOriginOf, useBackToSection } from "./useBackToSection";

function Probe() {
  const back = useBackToSection();
  return back.onBack ? (
    <button type="button" onClick={back.onBack}>
      {`Back to ${back.backLabel}`}
    </button>
  ) : (
    <p>No back control</p>
  );
}

const open = (path: string, state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/:sectionId/*" element={<Probe />} />
        <Route path="/a/:agencyId/menu/:sectionId" element={<p>The section page</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  openAgency("town");
  holdGroupIn("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async () => ({ name: "Zoldhalom", modules: [] }));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const sectionIds = sectionHeads.map((head) => head.id);

const sectionModules = Object.values(import.meta.glob<Record<string, Record<string, AgencyScreen>>>("./sections/*/paths.ts", { eager: true }));

const sectionScreens = sectionModules.flatMap((module) => Object.values(module).flatMap((paths) => Object.values(paths)));

const menuScreens = [...allScreens, ...sectionScreens].filter((screen) => /\/menu\/[^/]+\/./.test(screen.pattern));

describe("the back control of a menu screen opened without an origin", () => {
  it("goes to its section when the page is opened by its address, as Ownership & Tenure was", async () => {
    open("/a/town/menu/properties/ownership-tenure");

    await userEvent.click(await screen.findByRole("button", { name: /Back to Places & Addresses/ }));

    expect(await screen.findByText("The section page")).toBeInTheDocument();
  });

  it("keeps the origin the person came from when there is one", async () => {
    open("/a/town/menu/properties/ownership-tenure", { from: { path: "/a/town/menu/finance", title: "Finance" } });

    expect(await screen.findByRole("button", { name: /Back to Finance/ })).toBeInTheDocument();
  });

  it("draws no back control on the section page itself", () => {
    expect(backOriginOf("/a/town/menu/properties")).toBeNull();
  });

  it.each(menuScreens.map((screen) => [screen.pattern]))("gives %s a way back to a known section", (pattern) => {
    const pathname = pattern.replace("/a/:agencyId", "/a/town").replace(/:\w+/g, "x");

    const origin = backOriginOf(pathname);

    expect(origin).not.toBeNull();
    expect(sectionIds).toContain(origin?.sectionId);
  });
});

const risksClient = { myGaps: async () => [], myRisks: async () => [], myActions: async () => [] } as unknown as RisksClient;

const councilClient = { load: async () => ({ risks: [], overdueActions: [] }) } as unknown as CouncilRisksClient;

const openStandalone = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/a/:agencyId/risks" element={<p>The risk list</p>} />
        <Route path={`/a/:agencyId/${homeSegment}`} element={<p>The home page</p>} />
        <Route path="/a/:agencyId/risk-gaps" element={<GapsPage client={risksClient} />} />
        <Route path="/a/:agencyId/menu/council" element={<p>The council section</p>} />
        <Route path="/a/:agencyId/council/risks" element={<CouncilRisksPage client={councilClient} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("the standalone screens that sit under a list or a section", () => {
  it("gives the gaps page a Back to the risk list", async () => {
    openStandalone("/a/town/risk-gaps");

    await userEvent.click(await screen.findByRole("button", { name: "‹ Risks" }));

    expect(await screen.findByText("The risk list")).toBeInTheDocument();
  });

  it("gives the council risks page a Back to the council section", async () => {
    openStandalone("/a/town/council/risks");

    await userEvent.click(await screen.findByRole("button", { name: "‹ Decisions" }));

    expect(await screen.findByText("The council section")).toBeInTheDocument();
  });
});

const openRisks = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/a/:agencyId/risks" element={<RisksPage client={risksClient} />} />
        <Route path={`/a/:agencyId/${homeSegment}`} element={<p>The home page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("the screens that sit under Home", () => {
  it("gives the risk list a Back to Home, as it is reached from a Home card", async () => {
    openRisks("/a/town/risks");

    await userEvent.click(await screen.findByRole("button", { name: "‹ Home" }));

    expect(await screen.findByText("The home page")).toBeInTheDocument();
  });

  it("gives the backlogs gate a Back to Home while the person has no role", async () => {
    render(
      <MemoryRouter initialEntries={["/a/town/backlogs"]}>
        <Routes>
          <Route path="/a/:agencyId/backlogs" element={<NeedsRole ask={async () => false}>The backlogs</NeedsRole>} />
          <Route path={`/a/:agencyId/${homeSegment}`} element={<p>The home page</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "‹ Home" }));

    expect(await screen.findByText("The home page")).toBeInTheDocument();
  });
});

const sources = import.meta.glob<string>(["../../**/*.tsx", "!../../**/*.test.tsx"], { query: "?raw", import: "default", eager: true });

const rootScreens = ["app/TabPage.tsx", "app/home/MyWorkPage.tsx", "features/chat/ChatPage.tsx", "features/groups/GroupGate.tsx", "features/groups/NoGroupPage.tsx"];

const fileOf = (key: string) => new URL(key, import.meta.url).pathname.split("/src/")[1] ?? key;

const wiresItsBack = (source: string) => /onBack|useBackToSection|\.\.\.back/.test(source);

describe("every screen that draws a Shell", () => {
  it("is a root of the bottom bar or wires a back control", () => {
    const withoutBack = Object.entries(sources)
      .map(([key, source]) => ({ file: fileOf(key), source }))
      .filter(({ source }) => source.includes("<Shell"))
      .filter(({ file, source }) => !rootScreens.includes(file) && !wiresItsBack(source))
      .map(({ file }) => file);

    expect(withoutBack).toEqual([]);
  });

  it("names only roots that still draw a Shell", () => {
    const drawing = Object.entries(sources).filter(([, source]) => source.includes("<Shell")).map(([key]) => fileOf(key));
    const stale = rootScreens.filter((file) => !drawing.includes(file));

    expect(stale).toEqual([]);
  });
});

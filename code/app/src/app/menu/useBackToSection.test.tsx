import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
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

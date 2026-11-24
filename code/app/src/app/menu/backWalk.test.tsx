import { holdGroupIn } from "../../shared/testing/holdGroup";
import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { App } from "../App";
import { allScreens } from "../routes";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import * as me from "../../shared/wakala/me";

let landed = "";

function Where() {
  const { pathname } = useLocation();
  landed = pathname;
  return null;
}

type Way = { to: string };

const roots = ["/a/:agencyId/consent", "/a/:agencyId/menu/:sectionId"];

const ways: Record<string, Way> = {
  "/a/:agencyId/join": { to: "/a/town/do-something" },
  "/a/:agencyId/group": { to: "/a/town/home" },
  "/a/:agencyId/steps/:stepId": { to: "/a/town/do-something" },
  "/a/:agencyId/chat/assistant": { to: "/a/town/chat" },
  "/a/:agencyId/forms": { to: "/a/town/home" },
  "/a/:agencyId/forms/:id": { to: "/a/town/forms" },
  "/a/:agencyId/chat/:roomId/threads": { to: "/a/town/chat" },
  "/a/:agencyId/chat/:roomId/:threadId": { to: "/a/town/chat" },
  "/a/:agencyId/chat/:roomId/:threadId/asks/:askId": { to: "/a/town/chat/x/x" },
  "/a/:agencyId/question/new": { to: "/a/town/question" },
  "/a/:agencyId/question": { to: "/a/town/home" },
  "/a/:agencyId/risks": { to: "/a/town/home" },
  "/a/:agencyId/risks/:riskId": { to: "/a/town/risks" },
  "/a/:agencyId/risk-gaps": { to: "/a/town/risks" },
  "/a/:agencyId/risks/:riskId/safeguards/:barrierId/evidence": { to: "/a/town/risks/x" },
  "/a/:agencyId/council/late-matters": { to: "/a/town/menu/council" },
  "/a/:agencyId/council/risks": { to: "/a/town/menu/council" },
  "/a/:agencyId/start/:stepId": { to: "/a/town/do-something" },
  "/a/:agencyId/market": { to: "/a/town/do-something" },
  "/a/:agencyId/market/:productId": { to: "/a/town/market" },
  "/a/:agencyId/market/:productId/buy/:offerId": { to: "/a/town/market/x" },
  "/a/:agencyId/market/orders/:orderId": { to: "/a/town/market" },
  "/a/:agencyId/market/bought/:orderId": { to: "/a/town/market" },
  "/a/:agencyId/market/:productId/group-orders/:groupOrderId": { to: "/a/town/market/x" },
  "/a/:agencyId/market/:productId/group-orders/:groupOrderId/join": { to: "/a/town/market/x/group-orders/x" },
};

const outsideMenu = allScreens.map((screen) => screen.pattern).filter((pattern) => !/\/menu\/[^/]+\/./.test(pattern));

const pathOf = (pattern: string) => pattern.replace("/a/:agencyId", "/a/town").replace(/:\w+/g, "x");

beforeEach(() => {
  openAgency("town");
  holdGroupIn("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async () => ({}) as never);
  vi.spyOn(me, "checkSession").mockResolvedValue("in" as never);
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const open = (pattern: string) =>
  render(
    <MemoryRouter initialEntries={[pathOf(pattern)]}>
      <App />
      <Where />
    </MemoryRouter>,
  );

describe("the back control of every registered screen outside the menu sections", () => {
  it("names every such screen as a root or gives it a destination", () => {
    const named = [...roots, ...Object.keys(ways)];

    expect(outsideMenu.filter((pattern) => !named.includes(pattern))).toEqual([]);
    expect(named.filter((pattern) => !outsideMenu.includes(pattern))).toEqual([]);
  });

  it.each(Object.entries(ways))("%s has a named Back control that goes to its parent", async (pattern, way) => {
    open(pattern);

    const back = (await screen.findAllByRole("button", { name: /^(Back|‹ .+)$/ })).find((button) => button.classList.contains("back"));
    expect(back).toBeDefined();

    await userEvent.click(back as HTMLElement);

    expect(landed).toBe(way.to);
  });

  it.each(roots)("%s draws no back control", async (pattern) => {
    open(pattern);

    await screen.findByRole("main");

    expect(document.querySelector(".back")).toBeNull();
  });
});

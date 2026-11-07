import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "./agency/open";
import { ToOpenAgencyScreen } from "./pages/entry/OpenAgency";
import { allScreens, routes } from "./routes";

const farmers = "270e07b7-6b69-55ca-aa30-9441ce138541";
const riders = "c61e4358-10fd-539b-89f5-a7ccf4e94479";

beforeEach(() => forgetOpenAgency());

afterEach(() => forgetOpenAgency());

describe("a screen's path is built from one definition", () => {
  it.each([
    ["join", () => routes.join.path(), "/join", "/a/{id}/join"],
    ["start", () => routes.start.path({ stepId: "s1" }), "/start/:stepId", "/a/{id}/start/s1"],
    ["step", () => routes.step.path({ stepId: "s1" }), "/steps/:stepId", "/a/{id}/steps/s1"],
    ["market", () => routes.market.path(), "/market", "/a/{id}/market"],
    ["product", () => routes.product.path({ productId: "urea" }), "/market/:productId", "/a/{id}/market/urea"],
    ["buy now", () => routes.buyNow.path({ productId: "urea", offerId: "o1" }), "/market/:productId/buy/:offerId", "/a/{id}/market/urea/buy/o1"],
    ["market order", () => routes.marketOrder.path({ orderId: "or1" }), "/market/orders/:orderId", "/a/{id}/market/orders/or1"],
    ["bought order", () => routes.boughtOrder.path({ orderId: "or1" }), "/market/bought/:orderId", "/a/{id}/market/bought/or1"],
    ["group order", () => routes.groupOrder.path({ productId: "urea", groupOrderId: "g1" }), "/market/:productId/group-orders/:groupOrderId", "/a/{id}/market/urea/group-orders/g1"],
    ["join group order", () => routes.joinGroupOrder.path({ productId: "urea", groupOrderId: "g1" }), "/market/:productId/group-orders/:groupOrderId/join", "/a/{id}/market/urea/group-orders/g1/join"],
    ["forms", () => routes.forms.path(), "/forms", "/a/{id}/forms"],
    ["form", () => routes.form.path({ id: "f1" }), "/forms/:id", "/a/{id}/forms/f1"],
    ["room threads", () => routes.roomThreads.path({ roomId: "r1" }), "/chat/:roomId/threads", "/a/{id}/chat/r1/threads"],
    ["room thread", () => routes.roomThread.path({ roomId: "r1", threadId: "t1" }), "/chat/:roomId/:threadId", "/a/{id}/chat/r1/t1"],
    ["ask", () => routes.ask.path({ roomId: "r1", threadId: "t1", askId: "a1" }), "/chat/:roomId/:threadId/asks/:askId", "/a/{id}/chat/r1/t1/asks/a1"],
    ["risks", () => routes.risks.path(), "/risks", "/a/{id}/risks"],
    ["risk", () => routes.risk.path({ riskId: "r1" }), "/risks/:riskId", "/a/{id}/risks/r1"],
    ["risk evidence", () => routes.riskEvidence.path({ riskId: "r1", barrierId: "b1" }), "/risks/:riskId/safeguards/:barrierId/evidence", "/a/{id}/risks/r1/safeguards/b1/evidence"],
  ])("names the open agency in the %s path and keeps the old path as its retired one", (_, build, retired, built) => {
    openAgency(riders);
    expect(build()).toBe(built.replace("{id}", riders));
    const screen = allScreens.find((one) => one.retired === retired);
    expect(screen?.pattern).toBe(`/a/:agencyId${retired}`);
  });

  it("follows the agency opened last", () => {
    openAgency(farmers);
    const first = routes.forms.path();
    openAgency(riders);
    expect([first, routes.forms.path()]).toEqual([`/a/${farmers}/forms`, `/a/${riders}/forms`]);
  });

  it("builds a path in an agency the caller names whatever is open", () => {
    openAgency(farmers);
    expect(routes.market.pathIn(riders, {})).toBe(`/a/${riders}/market`);
  });

  it("falls back to the retired path while no agency is open, which sends the member to Your agencies", () => {
    expect(routes.market.path()).toBe("/market");
    expect(routes.buyNow.path({ productId: "urea", offerId: "o1" })).toBe("/market/urea/buy/o1");
  });

  it("encodes what it is given and adds the query", () => {
    openAgency(riders);
    expect(routes.buyNow.path({ productId: "dap 18/46", offerId: "o1" }, { yes: "y 1" })).toBe(`/a/${riders}/market/dap%2018%2F46/buy/o1?yes=y+1`);
  });

  it("gives every screen a pattern of its own", () => {
    expect(new Set(allScreens.map((one) => one.pattern)).size).toBe(allScreens.length);
    expect(new Set(allScreens.map((one) => one.retired)).size).toBe(allScreens.length);
  });
});

function Where() {
  const { pathname, search, state } = useLocation();
  return <p data-testid="where">{`${pathname}${search}|${JSON.stringify(state)}`}</p>;
}

const redirected = (from: string, state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: from.split("?")[0], search: from.includes("?") ? `?${from.split("?")[1]}` : "", state }]}>
      <Routes>
        {allScreens.map((one) => (
          <Route key={one.retired} path={one.retired} element={<ToOpenAgencyScreen screen={one} />} />
        ))}
        <Route path="/agencies" element={<p>Your agencies</p>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe("a retired path goes to the open agency's equivalent", () => {
  it.each([
    ["/join", "/join"],
    ["/start/s1", "/start/s1"],
    ["/market", "/market"],
    ["/market/urea", "/market/urea"],
    ["/market/urea/buy/o1?yes=y1", "/market/urea/buy/o1?yes=y1"],
    ["/market/orders/or1", "/market/orders/or1"],
    ["/market/bought/or1", "/market/bought/or1"],
    ["/market/urea/group-orders/g1", "/market/urea/group-orders/g1"],
    ["/market/urea/group-orders/g1/join", "/market/urea/group-orders/g1/join"],
    ["/forms", "/forms"],
    ["/forms/f1", "/forms/f1"],
    ["/chat/r1/threads", "/chat/r1/threads"],
    ["/chat/r1/t1", "/chat/r1/t1"],
    ["/chat/r1/t1/asks/a1", "/chat/r1/t1/asks/a1"],
  ])("sends %s to the same screen inside the open agency", (from, tail) => {
    openAgency(riders);
    redirected(from);
    expect(screen.getByTestId("where")).toHaveTextContent(`/a/${riders}${tail}|`);
  });

  it("keeps the state the old link carried", () => {
    openAgency(riders);
    redirected("/forms/f1", { title: "Water levy" });
    expect(screen.getByTestId("where")).toHaveTextContent(`/a/${riders}/forms/f1|{"title":"Water levy"}`);
  });

  it.each(["/join", "/market/urea", "/forms/f1", "/chat/r1/t1"])("sends %s to Your agencies while no agency is open", (from) => {
    redirected(from);
    expect(screen.getByText("Your agencies")).toBeInTheDocument();
  });
});

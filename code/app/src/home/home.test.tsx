import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { agencyCards, homeCardsFor, type AgencyKind } from "./cards";
import type { AgencyView } from "../agency/modules";
import { HomePage, type DoSomethingSegment } from "../pages/HomePage";

type RowsProps = { kind?: string; view?: { modules: { code: string }[] } | null };

vi.mock("./StartRows", () => ({
  StartRows: ({ kind, view }: RowsProps) => <p>{`rows: ${kind}, ${view?.modules.map((module) => module.code).join(" ") ?? "no read"}`}</p>,
}));

vi.mock("../pages/started/Ongoing", () => ({
  Ongoing: ({ onStart }: { onStart: () => void }) => (
    <button type="button" onClick={onStart}>
      ongoing rows
    </button>
  ),
}));

vi.mock("../coordinator/payments/OrderCards", () => ({ CoordinatorOrderCards: () => <p>order cards</p> }));

vi.mock("../sell/buyer/BuyerHome", () => ({ BuyerHome: () => <p>buyer home</p> }));

const kinds: AgencyKind[] = ["farmers", "supplier"];

const read: AgencyView = { name: "Alego Growers", modules: [{ code: "forms", name: "Forms" }, { code: "market", name: "Market" }], modulesUnread: false };

const home = (kind?: AgencyKind, view?: AgencyView, segment?: DoSomethingSegment) => (
  <MemoryRouter initialEntries={[segment === "ongoing" ? "/ongoing" : "/do-something"]}>
    <Routes>
      <Route path="/do-something" element={<HomePage kind={kind} view={view} segment="start" />} />
      <Route path="*" element={<HomePage kind={kind} view={view} segment="ongoing" />} />
    </Routes>
  </MemoryRouter>
);

const renderHome = (kind?: AgencyKind, view?: AgencyView, segment?: DoSomethingSegment) => render(home(kind, view, segment));

const pageParts = () => Array.from(screen.getByRole("main").children).map((part) => part.textContent);

describe("home composition", () => {
  it.each(kinds)("lays the %s Do Something out as title, rows", (kind) => {
    renderHome(kind, read);
    expect(screen.getByRole("heading", { level: 1, name: "Do Something" })).toBeInTheDocument();
    expect(pageParts()).toEqual([`rows: ${kind}, forms market`]);
  });

  it("draws the Start rows at once and the loading line under them while the agency kind is unknown", () => {
    renderHome();
    expect(pageParts()).toEqual(["rows: undefined, no read", "Loading your agency…"]);
  });

  it.each(kinds)("draws no order cards and no buyer home on the %s Do Something", (kind) => {
    renderHome(kind, read);
    expect(screen.queryByText("order cards")).not.toBeInTheDocument();
    expect(screen.queryByText("buyer home")).not.toBeInTheDocument();
  });

  it.each(kinds)("lists no account item in the %s Do Something page, they belong to the account menu", (kind) => {
    renderHome(kind);
    const page = within(screen.getByRole("main"));
    ["My profile", "Switch agency", "Change language", "Sign out"].forEach((title) =>
      expect(page.queryByText(title)).not.toBeInTheDocument(),
    );
  });

  it.each(kinds)("paints no agency name in the %s Do Something page, the top bar carries it", (kind) => {
    renderHome(kind, { name: "Alego Growers", modules: [], modulesUnread: true });
    expect(screen.getByRole("main").querySelector(".sub")).toBeNull();
    expect(screen.queryByText("Alego Growers")).not.toBeInTheDocument();
  });
});

describe("Start and Ongoing", () => {
  it("opens on Start", () => {
    renderHome("farmers", read);
    expect(screen.getByText("rows: farmers, forms market")).toBeInTheDocument();
    expect(screen.queryByText("ongoing rows")).not.toBeInTheDocument();
  });

  it("draws the Ongoing rows on the Ongoing segment, under the title", () => {
    renderHome("farmers", read, "ongoing");
    expect(pageParts()).toEqual(["ongoing rows"]);
  });

  it("takes the Ongoing rows' Go to Start to the Do Something page", async () => {
    renderHome("farmers", read, "ongoing");
    await userEvent.click(screen.getByRole("button", { name: "ongoing rows" }));
    expect(screen.getByText("rows: farmers, forms market")).toBeInTheDocument();
  });

  it("draws no loading line under the Ongoing rows while the agency kind is unknown", () => {
    renderHome(undefined, undefined, "ongoing");
    expect(screen.queryByText("Loading your agency…")).not.toBeInTheDocument();
  });

  it("draws no Start and Ongoing buttons in the page, they are tabs in the bar", () => {
    renderHome("farmers", read);
    expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ongoing" })).not.toBeInTheDocument();
  });
});

describe("home cards read from the agency's modules", () => {
  const view = (codes: string[], name = "Read Name") => ({ name, modules: codes.map((code) => ({ code, name: `${code} name` })) });

  it("drops the market cards from an agency whose market is off", () => {
    const titles = homeCardsFor("supplier", view(["forms"])).map((c) => c.title);
    expect(titles).not.toContain("Offers");
    expect(titles).not.toContain("Your prices");
    expect(titles).toContain("forms name");
  });

  it("adds the risks card only when the agency has the riskmanager module", () => {
    const withRisks = homeCardsFor("farmers", view(["forms", "riskmanager"]));
    expect(withRisks.find((c) => c.titleKey === "risksTitle")).toMatchObject({ title: "riskmanager name", path: "/risks" });
    expect(homeCardsFor("farmers", view(["forms"])).some((c) => c.titleKey)).toBe(false);
    expect(agencyCards.farmers.some((c) => c.titleKey)).toBe(false);
  });

  it("keeps the literal cards when the read failed", () => {
    expect(homeCardsFor("farmers", { name: "", modules: [], modulesUnread: true })).toEqual(agencyCards.farmers);
    expect(homeCardsFor("farmers", null)).toEqual(agencyCards.farmers);
  });
});

describe("home cards and workflows", () => {
  it("holds cards for the two agency kinds the app produces, farmers and supplier", () => {
    expect(Object.keys(agencyCards)).toEqual(["farmers", "supplier"]);
  });

  it.each(kinds)("leaves Join a group and Apply as a supplier to the %s agency's workflow steps, not its cards", (kind) => {
    const titles = agencyCards[kind].map((card) => card.title.toLowerCase());
    expect(titles).not.toContain("join group");
    expect(titles).not.toContain("join a group");
    expect(titles).not.toContain("apply as a supplier");
  });
});

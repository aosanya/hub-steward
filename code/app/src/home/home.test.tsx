import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { agencyCards, homeCardsFor, type AgencyKind } from "./cards";
import type { AgencyView } from "../agency/modules";
import { HomePage } from "../pages/HomePage";

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

const home = (kind?: AgencyKind, view?: AgencyView) => (
  <MemoryRouter>
    <HomePage kind={kind} view={view} />
  </MemoryRouter>
);

const renderHome = (kind?: AgencyKind, view?: AgencyView) => render(home(kind, view));

const pageParts = () => Array.from(screen.getByRole("main").children).map((part) => part.textContent);

const segment = (name: string) => screen.getByRole("button", { name });

describe("home composition", () => {
  it.each(kinds)("lays the %s Do Something out as title, name, Start and Ongoing, rows", (kind) => {
    renderHome(kind, read);
    expect(screen.getByRole("heading", { level: 1, name: "Do Something" })).toBeInTheDocument();
    expect(pageParts()).toEqual(["Alego Growers", "StartOngoing", `rows: ${kind}, forms market`]);
  });

  it("draws the Start rows at once and the loading line under them while the agency kind is unknown", () => {
    renderHome();
    expect(pageParts()).toEqual(["StartOngoing", "rows: undefined, no read", "Loading your agency…"]);
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

  it.each(kinds)("paints no agency name on the %s Do Something before the agency has answered", (kind) => {
    renderHome(kind);
    expect(screen.getByRole("main").querySelector(".sub")).toBeNull();
  });

  it.each(kinds)("paints the name the agency answered under the title on the %s Do Something", (kind) => {
    renderHome(kind, { name: "Alego Growers", modules: [], modulesUnread: true });
    const name = screen.getByText("Alego Growers");
    expect(name).toHaveClass("sub");
    expect(screen.getByRole("main")).toContainElement(name);
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("paints no agency name when the agency answered without one", () => {
    renderHome("farmers", { name: "", modules: [], modulesUnread: true });
    expect(screen.getByRole("main").querySelector(".sub")).toBeNull();
  });
});

describe("Start and Ongoing", () => {
  it("opens on Start", () => {
    renderHome("farmers", read);
    expect(segment("Start")).toHaveAttribute("aria-pressed", "true");
    expect(segment("Ongoing")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("ongoing rows")).not.toBeInTheDocument();
  });

  it("swaps the Start rows for the Ongoing rows when she chooses Ongoing, and back", async () => {
    renderHome("farmers", read);
    await userEvent.click(segment("Ongoing"));
    expect(segment("Ongoing")).toHaveAttribute("aria-pressed", "true");
    expect(pageParts()).toEqual(["Alego Growers", "StartOngoing", "ongoing rows"]);
    await userEvent.click(segment("Start"));
    expect(pageParts()).toEqual(["Alego Growers", "StartOngoing", "rows: farmers, forms market"]);
  });

  it("returns to Start when the Ongoing rows ask for it", async () => {
    renderHome("farmers", read);
    await userEvent.click(segment("Ongoing"));
    await userEvent.click(screen.getByRole("button", { name: "ongoing rows" }));
    expect(segment("Start")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("rows: farmers, forms market")).toBeInTheDocument();
  });

  it("draws no loading line under the Ongoing rows while the agency kind is unknown", async () => {
    renderHome();
    await userEvent.click(segment("Ongoing"));
    expect(screen.queryByText("Loading your agency…")).not.toBeInTheDocument();
  });

  it("keeps her choice when the agency kind arrives", async () => {
    const { rerender } = renderHome();
    await userEvent.click(segment("Ongoing"));
    rerender(home("farmers", read));
    expect(segment("Ongoing")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("ongoing rows")).toBeInTheDocument();
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

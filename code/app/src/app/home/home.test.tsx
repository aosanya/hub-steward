import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { agencyCards, homeCardsFor, type AgencyKind } from "./cards";
import type { AgencyView } from "../../features/agency/modules";
import { MyWorkPage, type MyWorkSegment } from "./MyWorkPage";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";

type RowsProps = { kind?: string; view?: { modules: { code: string }[] } | null };

vi.mock("./StartRows", () => ({
  StartRows: ({ kind, view }: RowsProps) => <p>{`rows: ${kind}, ${view?.modules.map((module) => module.code).join(" ") ?? "no read"}`}</p>,
}));

vi.mock("./ToDoRows", () => ({ ToDoRows: () => <p>to do rows</p> }));

vi.mock("../../features/started/Ongoing", () => ({
  Ongoing: ({ onStart }: { onStart: () => void }) => (
    <button type="button" onClick={onStart}>
      ongoing rows
    </button>
  ),
}));

vi.mock("../../features/market/payments/OrderCards", () => ({ CoordinatorOrderCards: () => <p>order cards</p> }));

vi.mock("../../features/market/sell/buyer/BuyerHome", () => ({ BuyerHome: () => <p>buyer home</p> }));

const kinds: AgencyKind[] = ["farmers", "supplier"];

const read: AgencyView = { name: "Alego Growers", modules: [{ code: "forms", name: "Forms" }, { code: "market", name: "Market" }], modulesUnread: false };

let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const renderHome = (kind?: AgencyKind, view?: AgencyView, segment: MyWorkSegment = "start") => {
  const paths = { todo: "/a/walk/my-work", start: "/a/walk/do-something", ongoing: "/a/walk/ongoing" };
  openAgency("walk");
  return render(
    <MemoryRouter initialEntries={[paths[segment]]}>
      <Routes>
        <Route path="*" element={<MyWorkPage kind={kind} view={view} segment={segment} />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
};

afterEach(() => forgetOpenAgency());

const pageParts = () => Array.from(screen.getByRole("main").children).map((part) => part.textContent);

describe("My work", () => {
  it("is titled My work with the three tabs To do, Ongoing and Start, and no Back", () => {
    renderHome("farmers", read, "todo");
    expect(screen.getByRole("heading", { level: 1, name: "My work" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "My work" })).getAllByRole("button").map((button) => button.textContent)).toEqual(["To do", "Ongoing", "Start"]);
    expect(screen.queryByRole("button", { name: /Back|Home/ })).not.toBeInTheDocument();
  });

  it.each<[MyWorkSegment, string]>([
    ["todo", "to do rows"],
    ["ongoing", "ongoing rows"],
    ["start", "rows: farmers, forms market"],
  ])("opens on the %s tab with its rows and the tab pressed", (segment, rows) => {
    renderHome("farmers", read, segment);
    expect(screen.getByText(rows)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
  });

  it.each<[string, string]>([
    ["To do", "/a/walk/my-work"],
    ["Ongoing", "/a/walk/ongoing"],
    ["Start", "/a/walk/do-something"],
  ])("goes to the page of %s when its tab is pressed", async (name, path) => {
    renderHome("farmers", read, name === "Start" ? "todo" : "start");
    await userEvent.click(within(screen.getByRole("group", { name: "My work" })).getByRole("button", { name }));
    expect(landed).toBe(path);
  });

  it.each(kinds)("lays the %s Start tab out as the tabs, then rows", (kind) => {
    renderHome(kind, read);
    expect(pageParts().at(-1)).toBe(`rows: ${kind}, forms market`);
  });

  it("draws the Start rows at once and the loading line under them while the agency kind is unknown", () => {
    renderHome();
    expect(pageParts().slice(-2)).toEqual(["rows: undefined, no read", "Loading your agency…"]);
  });

  it("takes the Ongoing rows' Go to Start to the Start page", async () => {
    renderHome("farmers", read, "ongoing");
    await userEvent.click(screen.getByRole("button", { name: "ongoing rows" }));
    expect(landed).toBe("/a/walk/do-something");
  });

  it("draws no loading line under the Ongoing rows while the agency kind is unknown", () => {
    renderHome(undefined, undefined, "ongoing");
    expect(screen.queryByText("Loading your agency…")).not.toBeInTheDocument();
  });

  it.each(kinds)("draws no order cards and no buyer home on the %s page", (kind) => {
    renderHome(kind, read);
    expect(screen.queryByText("order cards")).not.toBeInTheDocument();
    expect(screen.queryByText("buyer home")).not.toBeInTheDocument();
  });

  it.each(kinds)("lists no account item in the %s page, they belong to the account menu", (kind) => {
    renderHome(kind);
    const page = within(screen.getByRole("main"));
    ["My profile", "Switch agency", "Change language", "Sign out"].forEach((title) => expect(page.queryByText(title)).not.toBeInTheDocument());
  });

  it("names the tabs in Swahili and Hungarian", () => {
    window.localStorage.setItem("hub.language", "sw");
    renderHome("farmers", read, "todo");
    expect(within(screen.getByRole("group", { name: "My work" })).getAllByRole("button").map((button) => button.textContent)).toEqual(["Za kufanya", "Zinazoendelea", "Anza"]);
    window.localStorage.setItem("hub.language", "hu");
    renderHome("farmers", read, "todo");
    expect(screen.getAllByRole("group", { name: "My work" }).at(-1)?.textContent).toBe("TeendőkFolyamatbanIndítás");
    window.localStorage.removeItem("hub.language");
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

  it("adds the question card only when the agency has the voting module", () => {
    expect(homeCardsFor("farmers", view(["forms", "voting"]))).toContainEqual({ title: "Question", path: "/question" });
    expect(homeCardsFor("farmers", view(["forms"])).some((c) => c.path === "/question")).toBe(false);
    expect(agencyCards.farmers.some((c) => c.path === "/question")).toBe(false);
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

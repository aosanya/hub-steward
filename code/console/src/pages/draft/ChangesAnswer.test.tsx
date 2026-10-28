import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { DraftChange } from "../../data/draft";
import { I18nProvider } from "../../i18n";
import { ConsoleCtx, type ConsoleContext } from "../../shell/context";
import { DraftCtx } from "../../shell/draftContext";
import type { DraftApi } from "../../shell/useDraft";
import { GoalsView } from "../views/GoalsView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn(async () => ({ items: [] })) }));

const words = JSON.parse(readFileSync(resolve(__dirname, "../../../public/i18n.json"), "utf8"));

const objective: DraftChange = {
  id: "a1",
  summary: "Add the objective Record each farmer's payment",
  title: "Record each farmer's payment",
  kindWord: "draft.kindObjective",
  page: "goals",
  decidedBy: "Amos",
  at: "2026-10-20T09:40:00Z",
};
const role: DraftChange = { ...objective, id: "a2", summary: "Add the role Treasurer", title: "Treasurer", kindWord: "draft.kindRole", page: "roles", at: "2026-10-20T09:12:00Z" };
const profile: DraftChange = { ...objective, id: "a3", summary: "Rename this agency to Siaya Farmers", title: "Siaya Farmers", kindWord: "draft.kindProfile", page: "profile" };

const draft = (over: Partial<DraftApi> = {}): DraftApi => ({
  state: "pending",
  ready: true,
  changes: [objective, role, profile],
  problems: [],
  version: null,
  publish: () => {},
  ...over,
});

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
}

function open(api: DraftApi, lang = "en") {
  localStorage.setItem("lang", lang);
  const value: ConsoleContext = { hub: { id: "h1", name: "Siaya hub", role: "owner" }, page: "goals", setBadges: () => {}, refreshMenu: () => {} };
  render(
    <I18nProvider initial={words}>
      <MemoryRouter initialEntries={["/h/h1/goals?changes=1"]}>
        <ConsoleCtx.Provider value={value}>
          <DraftCtx.Provider value={api}>
            <Routes>
              <Route path="/h/:hubId/:page" element={<GoalsView />} />
            </Routes>
            <Where />
          </DraftCtx.Provider>
        </ConsoleCtx.Provider>
      </MemoryRouter>
    </I18nProvider>,
  );
}

afterEach(() => localStorage.clear());

describe("the answer to what is not published", () => {
  it("opens on the Goals page with the question it answers, in the content area", () => {
    open(draft());
    expect(screen.getByRole("heading", { name: "Goals" })).toBeInTheDocument();
    const answer = screen.getByRole("region", { name: "Answer from the chat" });
    expect(within(answer).getByText("What is not published?")).toBeInTheDocument();
  });

  it("lists each change on a line under Kind, Title, Approved by and When", () => {
    open(draft());
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Kind", "Title", "Approved by", "When", ""]);
    expect(within(table).getAllByRole("row")).toHaveLength(4);
  });

  it("shows for a change its kind as a quiet chip, its title, what it did, who approved it and when", () => {
    open(draft());
    const row = screen.getByText("Record each farmer's payment").closest("tr") as HTMLElement;
    expect(within(row).getByText("Objective").closest(".tag")).toHaveClass("mute");
    expect(within(row).getByText("Add the objective Record each farmer's payment")).toBeInTheDocument();
    expect(within(row).getByText("Amos")).toBeInTheDocument();
    expect(row.querySelector(".count")?.textContent).toMatch(/\d{2}:\d{2}/);
  });

  it("opens the page that holds each change", () => {
    open(draft());
    const links = within(screen.getByRole("table")).getAllByRole("link", { name: "Open" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/h/h1/goals", "/h/h1/roles", "/h/h1/profile"]);
  });

  it("does not repeat the summary under a title that says the same", () => {
    open(draft({ changes: [{ ...objective, title: objective.summary }] }));
    expect(screen.getAllByText(objective.summary)).toHaveLength(1);
  });

  it("goes back to the goals when Clear is pressed", async () => {
    const user = userEvent.setup();
    open(draft());
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/h/h1/goals");
    expect(screen.getByTestId("where").textContent).not.toContain("changes");
  });

  it("says nothing is waiting when no change is left", () => {
    open(draft({ state: "none", changes: [] }));
    expect(screen.getByText("Nothing is waiting to be published.")).toBeInTheDocument();
  });

  it("shows no table and no empty message until the changes have been read", () => {
    open(draft({ ready: false, changes: [] }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Nothing is waiting to be published.")).not.toBeInTheDocument();
  });

  it("speaks German when the manager chose German", () => {
    open(draft(), "de");
    expect(screen.getByText("Was ist nicht veröffentlicht?")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Teilziel")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Genehmigt von")).toBeInTheDocument();
  });
});

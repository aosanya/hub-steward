import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { I18nProvider } from "../../i18n";
import { RisksLanding } from "./RisksLanding";

vi.mock("../../wakala/mcp");

const english = {
  en: {
    "menu.risks": "Risks",
    noRows: "Nothing here yet.",
    loadFailed: "The page could not be loaded.",
    "risks.none": "No risks yet.",
    "risks.add": "Add a risk",
    edit: "Edit",
    "risks.search": "Search bowties",
    "risks.risk": "Risk",
    "goals.open": "Open",
    "risks.topEvent": "Top event",
    "risks.owner": "Owner",
    "risks.status": "Status",
    "risks.threats": "Threats · {n}",
    "risks.consequences": "Consequences · {n}",
    "risks.threat": "Threat",
    "risks.consequence": "Consequence",
    "risks.safeguards": "Safeguards",
    "risks.noSafeguards": "No safeguards",
    "risks.drillDown": "{n} drill-down",
    "risks.noOwner": "No owner",
  },
};

const show = () =>
  render(
    <I18nProvider initial={english}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RisksLanding hubId="h1" />
      </MemoryRouter>
    </I18nProvider>,
  );

const answer = (replies: Record<string, unknown>) =>
  vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
    if (replies[tool] instanceof Error) throw replies[tool];
    return replies[tool] as never;
  });

beforeEach(() => vi.mocked(callTool).mockReset());

describe("the risks landing", () => {
  it("lists every risk with its top event and owner", async () => {
    answer({
      agency_list_drafts: { items: [] },
      agency_list_risks: {
        items: [
          { id: "r2", code: "RK-2", title: "Data leak", top_event: "A leak", owner: "Chair" },
          { id: "r3", code: "RK-3", title: "Flood", top_event: "River rises" },
        ],
      },
    });
    show();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "RK-2 · Data leak" }));
    await user.click(screen.getByRole("button", { name: "RK-3 · Flood" }));
    expect(screen.getByText("A leak")).toBeTruthy();
    expect(screen.getByText("Chair")).toBeTruthy();
    expect(screen.getByText("No owner")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Edit" })[1].getAttribute("href")).toContain("?risk=r3");
  });

  it("lists the risks by their title whatever order they arrive in", async () => {
    answer({
      agency_list_drafts: { items: [] },
      agency_list_risks: {
        items: [
          { id: "r3", code: "RK-3", title: "Flood", top_event: "River rises" },
          { id: "r2", code: "RK-2", title: "Data leak", top_event: "A leak" },
        ],
      },
    });
    show();
    await screen.findByRole("button", { name: "RK-2 · Data leak" });
    expect(screen.getAllByRole("button", { name: /Data leak|Flood/ }).map((button) => button.textContent)).toEqual(["RK-2 · Data leak", "RK-3 · Flood"]);
  });

  it("narrows the list by the search", async () => {
    answer({
      agency_list_drafts: { items: [] },
      agency_list_risks: {
        items: [
          { id: "r2", code: "RK-2", title: "Data leak", top_event: "A leak" },
          { id: "r3", code: "RK-3", title: "Flood", top_event: "River rises" },
        ],
      },
    });
    show();
    await userEvent.setup().type(await screen.findByRole("searchbox"), "flood");
    expect(screen.queryByRole("button", { name: "RK-2 · Data leak" })).toBeNull();
    expect(screen.getByRole("button", { name: "RK-3 · Flood" })).toBeTruthy();
  });

  it("says so when the register is empty", async () => {
    answer({ agency_list_drafts: { items: [] }, agency_list_risks: { items: [] } });
    show();
    expect(await screen.findByText("No risks yet.")).toBeTruthy();
  });

  it("says so when the register cannot be read", async () => {
    answer({ agency_list_drafts: { items: [] }, agency_list_risks: new Error("offline") });
    show();
    expect(await screen.findByText("The page could not be loaded.")).toBeTruthy();
  });
});

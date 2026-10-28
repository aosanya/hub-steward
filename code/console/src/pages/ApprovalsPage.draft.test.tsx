import { render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { ConsoleCtx, type ConsoleContext } from "../shell/context";
import type { PageRow } from "../types";
import { McpError, callTool } from "../wakala/mcp";
import { ApprovalsPage } from "./ApprovalsPage";

vi.mock("../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const request = (over: PageRow): PageRow => ({
  id: "a1",
  summary: "Add the goal Grow maize",
  kind: "agency_create_goal",
  status: "approved",
  proposed_by: "Hub Steward",
  proposed_at: "2026-10-27T09:00:00Z",
  decided_by: "Amos",
  decided_at: "2026-10-27T10:00:00Z",
  ...over,
});

type Backend = { rows: PageRow[]; publications?: unknown[] | Error };

function openRequest(backend: Backend, id = "a1", lang = "en") {
  const asked: string[] = [];
  vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
    asked.push(tool);
    if (tool === "agency_list_approvals") return { items: backend.rows } as never;
    if (tool === "agency_list_publications") {
      if (backend.publications instanceof Error) throw backend.publications;
      return { items: backend.publications ?? [] } as never;
    }
    throw new McpError("unexpected " + tool);
  });
  localStorage.setItem("lang", lang);
  const value: ConsoleContext = {
    hub: { id: "h1", name: "Siaya hub", role: "owner" },
    page: "approvals",
    setBadges: () => {},
    refreshMenu: () => {},
  };
  render(
    <I18nProvider initial={words}>
      <MemoryRouter initialEntries={[`/h/h1/approvals/pending?request=${id}`]}>
        <ConsoleCtx.Provider value={value}>
          <Routes>
            <Route path="/h/:hubId/approvals/:tab" element={<ApprovalsPage />} />
          </Routes>
        </ConsoleCtx.Provider>
      </MemoryRouter>
    </I18nProvider>,
  );
  return asked;
}

afterEach(() => vi.mocked(callTool).mockReset());

describe("an approved request that changed the agency", () => {
  it("shows a row In the agency with a quiet Not published yet chip when the agency was never published", async () => {
    openRequest({ rows: [request({})] });
    const chip = await screen.findByText("Not published yet");
    expect(chip.closest(".tag")).toHaveClass("mute");
    const term = screen.getByText("In the agency");
    expect(term.tagName).toBe("DT");
    expect(term.nextElementSibling).toContainElement(chip);
    expect(term.nextElementSibling).toContainElement(screen.getByRole("link", { name: "Open Goals" }));
  });

  it("links the row to the page that holds the change", async () => {
    openRequest({ rows: [request({})] });
    await screen.findByText("Not published yet");
    expect(screen.getByRole("link", { name: "Open Goals" })).toHaveAttribute("href", "/h/h1/goals");
  });

  it("keeps the Approved chip in the status row", async () => {
    openRequest({ rows: [request({})] });
    await screen.findByText("Not published yet");
    const status = screen.getByText("Status").nextElementSibling as HTMLElement;
    expect(within(status).getByText("Approved")).toBeInTheDocument();
    expect(within(status).queryByText("Not published yet")).not.toBeInTheDocument();
  });

  it("shows the row when the last publication is older than the decision", async () => {
    openRequest({ rows: [request({})], publications: [{ version: 3, tag: "v3", published_at: "2026-10-27T09:30:00Z" }] });
    expect(await screen.findByText("Not published yet")).toBeInTheDocument();
  });

  it("links a role request to the Roles page", async () => {
    openRequest({ rows: [request({ kind: "agency_create_role", summary: "Add the role Treasurer" })] });
    await screen.findByText("Not published yet");
    expect(screen.getByRole("link", { name: "Open Roles" })).toHaveAttribute("href", "/h/h1/roles");
  });

  it("links an objective request to the Goals page", async () => {
    openRequest({ rows: [request({ kind: "agency_create_objective", summary: "Add the objective Buy seed" })] });
    await screen.findByText("Not published yet");
    expect(screen.getByRole("link", { name: "Open Goals" })).toHaveAttribute("href", "/h/h1/goals");
  });

  it("links a profile change to the Profile page", async () => {
    openRequest({ rows: [request({ kind: "agency_update_agency", summary: "Rename this agency to Siaya Farmers" })] });
    await screen.findByText("Not published yet");
    expect(screen.getByRole("link", { name: "Open Profile" })).toHaveAttribute("href", "/h/h1/profile");
  });

  it("shows no row once a publication was made after the decision", async () => {
    const asked = openRequest({ rows: [request({})], publications: [{ version: 4, tag: "v4", published_at: "2026-10-27T10:30:00Z" }] });
    await screen.findByText("Add the goal Grow maize");
    await waitFor(() => expect(asked).toContain("agency_list_publications"));
    await new Promise((resolveLater) => setTimeout(resolveLater, 30));
    expect(screen.queryByText("Not published yet")).not.toBeInTheDocument();
    expect(screen.queryByText("In the agency")).not.toBeInTheDocument();
  });

  it("shows no row when the publications cannot be read", async () => {
    const asked = openRequest({ rows: [request({})], publications: new McpError("wakala answered 500: down") });
    await screen.findByText("Add the goal Grow maize");
    await waitFor(() => expect(asked).toContain("agency_list_publications"));
    await new Promise((resolveLater) => setTimeout(resolveLater, 30));
    expect(screen.queryByText("Not published yet")).not.toBeInTheDocument();
  });

  it("speaks French in the row", async () => {
    localStorage.setItem("lang", "fr");
    openRequest({ rows: [request({})] }, "a1", "fr");
    expect(await screen.findByText("Pas encore publié")).toBeInTheDocument();
    expect(screen.getByText("Dans l'agence")).toBeInTheDocument();
  });
});

describe("a request that is not an approved change of the agency", () => {
  it("shows no chip and asks nothing about publications for a request that was refused", async () => {
    const asked = openRequest({ rows: [request({ status: "refused" })] });
    await screen.findByText("Add the goal Grow maize");
    expect(screen.queryByText("Not published yet")).not.toBeInTheDocument();
    expect(asked).not.toContain("agency_list_publications");
  });

  it("shows no chip and asks nothing about publications for a request still pending", async () => {
    const asked = openRequest({ rows: [request({ status: "pending", decided_at: "", decided_by: "" })] });
    await screen.findByText("Add the goal Grow maize");
    expect(screen.queryByText("Not published yet")).not.toBeInTheDocument();
    expect(asked).not.toContain("agency_list_publications");
  });

  it("shows no chip and asks nothing about publications for an approved request of another kind", async () => {
    const asked = openRequest({ rows: [request({ kind: "instance_rename", summary: "Rename this hub to Siaya" })] });
    await screen.findByText("Rename this hub to Siaya");
    expect(screen.queryByText("Not published yet")).not.toBeInTheDocument();
    expect(asked).not.toContain("agency_list_publications");
  });
});

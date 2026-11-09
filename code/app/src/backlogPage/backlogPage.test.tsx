import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { defaultBacklogId } from "../backlogs/api";
import { BacklogPage } from "./BacklogPage";
import { productOwnerGroup, stepOfIssue, stepsWithCounts, type BacklogPageClient } from "./api";
import { BacklogPageRoutes } from "./index";
import { isValidElement } from "react";
import { backlogPagePath } from "./paths";

const states = [
  { name: "To do", statuses: ["pending"] },
  { name: "Doing", statuses: ["in_progress", "split"] },
  { name: "Done", statuses: ["completed"] },
];

describe("steps with counts", () => {
  it("puts an issue in the step that covers its status", () => {
    expect(stepOfIssue(states, { step: "", status: "split" })?.name).toBe("Doing");
  });

  it("prefers the step an issue names", () => {
    expect(stepOfIssue(states, { step: "Done", status: "pending" })?.name).toBe("Done");
  });

  it("counts the issues at each step in order, including empty steps", () => {
    const issues = [
      { step: "", status: "pending" },
      { step: "", status: "pending" },
      { step: "", status: "in_progress" },
    ];
    expect(stepsWithCounts(states, issues)).toEqual([
      { name: "To do", issues: 2 },
      { name: "Doing", issues: 1 },
      { name: "Done", issues: 0 },
    ]);
  });
});

let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return <p>elsewhere</p>;
};

const clientOf = (page: BacklogPageClient["page"]): BacklogPageClient => ({ page });

const show = async (client: BacklogPageClient, backlogId = defaultBacklogId) => {
  landed = "";
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[backlogPagePath(backlogId)]}>
        <Routes>
          <Route path="/a/:agencyId/backlogs/:backlogId/page" element={<BacklogPage client={client} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

beforeEach(() => openAgency("hub1"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
});

const software = clientOf(async () => ({
  name: "Software",
  steps: [
    { name: "To do", issues: 3 },
    { name: "Doing", issues: 1 },
    { name: "Done", issues: 0 },
  ],
  groups: [productOwnerGroup],
}));

describe("the route", () => {
  it("is one route element for the backlogs routes to mount", () => {
    expect(isValidElement(BacklogPageRoutes)).toBe(true);
    expect((BacklogPageRoutes.props as { path: string }).path).toBe(":backlogId/page");
  });
});

describe("the backlog page", () => {
  it("names the backlog and counts its steps", async () => {
    await show(software);
    expect(await screen.findByRole("heading", { level: 1, name: "Software" })).toBeVisible();
    expect(screen.getByText("Backlog · 3 steps")).toBeVisible();
  });

  it("lists the steps in order with how many issues each holds", async () => {
    await show(software);
    await screen.findByText("Steps, in order");
    const rows = screen.getAllByText(/\d issues?$/).map((cell) => cell.closest(".row")!.textContent);
    expect(rows).toEqual(["To do3 issues", "Doing1 issue", "Done0 issues"]);
  });

  it("shows the Product owner group at Can move and says no other group has access", async () => {
    await show(software);
    const row = (await screen.findByText("Product owner")).closest(".row") as HTMLElement;
    expect(within(row).getByText("Can move")).toBeVisible();
    expect(screen.getByText("No other groups have access.")).toBeVisible();
  });

  it("shows another group with its level", async () => {
    await show(clientOf(async () => ({ name: "Software", steps: [], groups: [productOwnerGroup, { name: "Contributors", level: "Can see" }] })));
    const row = (await screen.findByText("Contributors")).closest(".row") as HTMLElement;
    expect(within(row).getByText("Can see")).toBeVisible();
    expect(screen.queryByText("No other groups have access.")).toBeNull();
  });

  it("offers no edit or access links, since the app does not know a role's permissions yet", async () => {
    await show(software);
    await screen.findByText("Who has access");
    expect(screen.queryByRole("link", { name: /edit|access/i })).toBeNull();
  });

  it("says so when the backlog is unknown", async () => {
    await show(clientOf(async () => undefined), "missing");
    expect(await screen.findByRole("alert")).toHaveTextContent("This could not be opened.");
  });

  it("says so when the load fails", async () => {
    await show(clientOf(vi.fn(async () => Promise.reject(new Error("down")))));
    expect(await screen.findByRole("alert")).toHaveTextContent("This could not be opened.");
  });

  it("goes back to the backlog's list", async () => {
    await show(software);
    await screen.findByText("Steps, in order");
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(landed).toBe(`/a/hub1/backlogs/${defaultBacklogId}`);
  });
});

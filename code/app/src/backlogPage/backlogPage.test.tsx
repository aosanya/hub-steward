import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { defaultBacklogId, taskTools } from "../backlogs/api";
import * as mcp from "../wakala/mcp";
import type { BacklogManageClient } from "../backlogManage";
import { BacklogPage } from "./BacklogPage";
import { mcpBacklogPageClient, productOwnerGroup, type BacklogPageClient } from "./api";
import { BacklogPageRoutes } from "./index";
import { isValidElement } from "react";
import { backlogPagePath } from "./paths";

const hubReply = {
  items: [
    {
      id: "backlog",
      name: "Backlog",
      issues: 1393,
      steps: [
        { id: "to-do", name: "To do", issues: 900 },
        { id: "doing", name: "Doing", issues: 80 },
        { id: "done", name: "Done", issues: 413 },
      ],
    },
    { id: "software", name: "Software", issues: 0, steps: [{ id: "idea", name: "Idea", issues: 0 }] },
  ],
};

describe("the page read from the hub", () => {
  it("takes the steps and their counts from the backlog list, past the 500 a list call returns", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue(hubReply as never);
    expect(await mcpBacklogPageClient.page("backlog")).toEqual({
      name: "Backlog",
      steps: [
        { name: "To do", issues: 900 },
        { name: "Doing", issues: 80 },
        { name: "Done", issues: 413 },
      ],
      groups: [productOwnerGroup],
    });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0][1]).toBe(taskTools.backlogs);
  });

  it("reads another backlog by its id and refuses one the hub does not list", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue(hubReply as never);
    expect((await mcpBacklogPageClient.page("software"))?.steps).toEqual([{ name: "Idea", issues: 0 }]);
    expect(await mcpBacklogPageClient.page("missing")).toBeUndefined();
  });
});

let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return <p>elsewhere</p>;
};

const clientOf = (page: BacklogPageClient["page"]): BacklogPageClient => ({ page });

const manager = (may: boolean) => ({ mayManage: vi.fn().mockResolvedValue(may) }) as unknown as BacklogManageClient;

const show = async (client: BacklogPageClient, backlogId = defaultBacklogId, manage = manager(false)) => {
  landed = "";
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[backlogPagePath(backlogId)]}>
        <Routes>
          <Route path="/a/:agencyId/backlogs/:backlogId/page" element={<BacklogPage client={client} manage={manage} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

beforeEach(() => openAgency("hub1"));

afterEach(() => {
  vi.restoreAllMocks();
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

  it("offers no edit link to a role that may not manage backlogs", async () => {
    await show(software, defaultBacklogId, manager(false));
    await screen.findByText("Who has access");
    expect(screen.queryByRole("link", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /who has access/i })).toBeNull();
  });

  it("offers an edit link to a role that may manage backlogs", async () => {
    await show(software, defaultBacklogId, manager(true));
    const link = await screen.findByRole("link", { name: "Edit this backlog" });
    expect(link).toHaveAttribute("href", `/a/hub1/backlogs/${defaultBacklogId}/edit`);
  });

  it("offers the access screen to a role that may manage backlogs", async () => {
    await show(software, defaultBacklogId, manager(true));
    const link = await screen.findByRole("link", { name: "Change who has access" });
    expect(link).toHaveAttribute("href", `/a/hub1/backlogs/${defaultBacklogId}/access`);
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

import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { defaultBacklogId, taskTools } from "../backlogs/api";
import * as mcp from "../wakala/mcp";
import type { BacklogManageClient } from "../backlogManage";
import { BacklogPage } from "./BacklogPage";
import { mcpBacklogPageClient, type BacklogPageClient } from "./api";
import { accessTools } from "../backlogAccess/api";
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

const accessReply = { owner_group: "g-owner", groups: [{ group_id: "g-owner", level: "move" }, { group_id: "g-support", level: "see" }] };

const groupsReply = { items: [{ id: "g-owner", name: "Maintainers" }, { id: "g-support", name: "Support" }] };

const hubAnswering = (access: unknown = accessReply, reply: unknown = hubReply) =>
  vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string) => {
    if (tool === taskTools.backlogs) return reply;
    if (tool === accessTools.list) {
      if (access instanceof Error) throw access;
      return access;
    }
    if (tool === accessTools.groups) return groupsReply;
    return { items: [] };
  }) as never);

describe("the page read from the hub", () => {
  it("takes the steps and their counts from the backlog list, past the 500 a list call returns", async () => {
    const call = hubAnswering();
    const data = await mcpBacklogPageClient.page("backlog");
    expect(data?.name).toBe("Backlog");
    expect(data?.steps).toEqual([
      { name: "To do", issues: 900 },
      { name: "Doing", issues: 80 },
      { name: "Done", issues: 413 },
    ]);
    expect(call.mock.calls.filter((one) => one[1] === taskTools.backlogs)).toHaveLength(1);
  });

  it("counts the issues at no step from what the backlog holds beyond its steps", async () => {
    hubAnswering(accessReply, { items: [{ id: "backlog", name: "Backlog", issues: 1450, steps: hubReply.items[0].steps }] });
    expect((await mcpBacklogPageClient.page("backlog"))?.noStep).toBe(57);
    hubAnswering();
    expect((await mcpBacklogPageClient.page("backlog"))?.noStep).toBe(0);
  });

  it("reads who has access from the hub, with the group names, the owner group first", async () => {
    hubAnswering();
    expect((await mcpBacklogPageClient.page("backlog"))?.access).toEqual({
      restricted: true,
      groups: [
        { name: "Maintainers", level: "Can edit" },
        { name: "Support", level: "Can see" },
      ],
    });
  });

  it("says nobody is restricted when the hub has no owner group, and invents no group", async () => {
    hubAnswering({ owner_group: "", groups: [] });
    expect((await mcpBacklogPageClient.page("backlog"))?.access).toEqual({ restricted: false, groups: [] });
  });

  it("leaves the access out when the person may not read it", async () => {
    hubAnswering(new Error("403"));
    const data = await mcpBacklogPageClient.page("backlog");
    expect(data?.name).toBe("Backlog");
    expect(data?.access).toBeUndefined();
  });

  it("reads another backlog by its id and refuses one the hub does not list", async () => {
    hubAnswering();
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
  noStep: 0,
  access: { restricted: true, groups: [{ name: "Product owner", level: "Can edit" }] },
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

  it("shows a No step row for issues at no step, and none when every issue has a step", async () => {
    await show(clientOf(async () => ({ name: "Software", steps: [{ name: "To do", issues: 3 }], noStep: 2, access: undefined })));
    const row = (await screen.findByText("No step")).closest(".row") as HTMLElement;
    expect(within(row).getByText("2 issues")).toBeVisible();
    cleanup();
    await show(software);
    await screen.findByText("Steps, in order");
    expect(screen.queryByText("No step")).toBeNull();
  });

  it("says nobody is restricted yet when the hub has no owner group", async () => {
    await show(clientOf(async () => ({ name: "Software", steps: [], noStep: 0, access: { restricted: false, groups: [] } })));
    expect(await screen.findByText("Nobody is restricted yet.")).toBeVisible();
  });

  it("leaves the access section out when the person may not read it", async () => {
    await show(clientOf(async () => ({ name: "Software", steps: [], noStep: 0, access: undefined })));
    await screen.findByText("Steps, in order");
    expect(screen.queryByText("Who has access")).toBeNull();
  });

  it("shows the Product owner group at Can edit and says no other group has access", async () => {
    await show(software);
    const row = (await screen.findByText("Product owner")).closest(".row") as HTMLElement;
    expect(within(row).getByText("Can edit")).toBeVisible();
    expect(screen.getByText("No other groups have access.")).toBeVisible();
  });

  it("shows another group with its level", async () => {
    await show(clientOf(async () => ({ name: "Software", steps: [], noStep: 0, access: { restricted: true, groups: [{ name: "Product owner", level: "Can edit" }, { name: "Contributors", level: "Can see" }] } })));
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
    await userEvent.click(screen.getByRole("button", { name: "‹ List" }));
    expect(landed).toBe(`/a/hub1/backlogs/${defaultBacklogId}`);
  });
});

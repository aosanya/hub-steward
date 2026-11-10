import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../agency/open";
import type { BacklogManageClient } from "../backlogManage/types";
import { SendToBacklogButton } from "../sendToBacklog";
import type { SendClient, Target } from "../sendToBacklog/types";
import type { Backlog, BacklogsClient, IssueDetail } from "./api";
import { IssuePage } from "./IssuePage";
import { IssuesPage } from "./IssuesPage";

const backlog = (issues: number): Backlog => ({ id: "b1", name: "Support", steps: ["To do"], issues });
const empty = (backlogs: Backlog[]): BacklogsClient => ({ backlogs: async () => backlogs, issues: async () => [], issue: async () => ({}) as never });
const may = (allowed: boolean) => ({ mayManage: async () => allowed }) as unknown as BacklogManageClient;

const listAt = (path: string, client: BacklogsClient, manage: BacklogManageClient) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/a/hub-1/backlogs/:backlogId" element={<IssuesPage client={client} manage={manage} smartBacklogs={async () => []} />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.restoreAllMocks();
  openAgency("hub-1");
});

describe("an empty list", () => {
  it("tells a person who cannot manage backlogs that there is nothing here yet, with no loader card", async () => {
    listAt("/a/hub-1/backlogs/b1", empty([backlog(0)]), may(false));
    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.queryByText(/Run the loader/)).not.toBeInTheDocument();
  });

  it("keeps the loader card for a person who may manage backlogs on a hub with no issues anywhere", async () => {
    listAt("/a/hub-1/backlogs/all", empty([backlog(0)]), may(true));
    expect(await screen.findByText(/Run the loader on your laptop/)).toBeInTheDocument();
    expect(screen.queryByText("Nothing here yet.")).not.toBeInTheDocument();
  });

  it("says nothing here yet to a manager when another backlog holds issues", async () => {
    listAt("/a/hub-1/backlogs/b1", empty([backlog(0), { id: "b2", name: "Software", steps: ["To do"], issues: 4 }]), may(true));
    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.queryByText(/Run the loader/)).not.toBeInTheDocument();
  });
});

const software: Target = { backlogId: "b1", name: "Software", stepId: "s1", stepName: "To do" };
const documentation: Target = { backlogId: "b2", name: "Documentation", stepId: "d1", stepName: "Draft" };
const sendClient = (): SendClient => ({ targets: async () => [software, documentation], send: async () => ({ sent: 1, refusal: "" }) });

const detail = (backlogId: string, name: string): IssueDetail => ({ id: "t1", title: "HS-001 Fix drift", description: "", status: "pending", step: "To do", repo: "web", topics: [], backlog: name, backlogId, mark: "Ready", rank: 1, waitsOn: [], waitedOnBy: [] });

describe("the issue page after Send to backlog", () => {
  it("keeps the one line 'sent to' while the issue reloads", async () => {
    const reads = [detail("b1", "Software"), detail("b2", "Documentation")];
    const issue = vi.fn().mockImplementation(async () => reads[Math.min(issue.mock.calls.length - 1, 1)]);
    const client: BacklogsClient = { backlogs: async () => [], issues: async () => [], issue };
    render(
      <MemoryRouter initialEntries={["/backlogs/issue/t1"]}>
        <Routes>
          <Route path="/backlogs/issue/:issueId" element={<IssuePage client={client} sendClient={sendClient()} />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Send to backlog" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByText("Documentation"));
    expect(await screen.findByText(/Documentation · /)).toBeInTheDocument();
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("1 issue sent to Documentation");
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("still shows the line next to the button when the button is used without a page", async () => {
    render(<SendToBacklogButton issueId="t1" client={sendClient()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Send to backlog" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByText("Documentation"));
    expect(await screen.findByRole("status")).toHaveTextContent("1 issue sent to Documentation");
  });
});

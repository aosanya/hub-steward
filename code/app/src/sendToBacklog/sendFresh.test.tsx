import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../agency/open";
import type { BacklogsClient, IssueDetail } from "../backlogs/api";
import { IssuePage } from "../backlogs/IssuePage";
import * as mcp from "../wakala/mcp";
import { sendTools } from "./api";
import { withoutCurrent } from "./leftOut";
import { SendToBacklog } from "./SendToBacklog";
import { SendToBacklogButton } from "./SendToBacklogButton";
import type { SendClient, Target } from "./types";

const software: Target = { backlogId: "b1", name: "Software", stepId: "s1", stepName: "To do" };
const documentation: Target = { backlogId: "b2", name: "Documentation", stepId: "d1", stepName: "Draft" };
const client = (targets: Target[]): SendClient => ({ targets: async () => targets, send: vi.fn().mockResolvedValue({ sent: 1, refusal: "" }) });

const issueIn = (backlog: string, backlogId: string, step: string): IssueDetail => ({ id: "t1", title: "HS-001 Fix drift", description: "", status: "pending", step, repo: "web", topics: [], backlog, backlogId, mark: "Ready", rank: 1, waitsOn: [], waitedOnBy: [] });

beforeEach(() => {
  vi.restoreAllMocks();
  openAgency("hub-1");
});

describe("leaving out the backlog the issues are already in", () => {
  it("drops a target only when every selected issue is in it", () => {
    expect(withoutCurrent([software, documentation], ["b1", "b1"])).toEqual([documentation]);
    expect(withoutCurrent([software, documentation], ["b1", "b2"])).toEqual([software, documentation]);
    expect(withoutCurrent([software, documentation], [])).toEqual([software, documentation]);
  });

  it("does not list the current backlog on the sheet", async () => {
    render(<SendToBacklog ids={["t1"]} from={["b1"]} client={client([software, documentation])} onClose={() => {}} onDone={() => {}} />);
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).queryByText("Software")).toBeNull();
    expect(within(sheet).getByText("Documentation")).toBeTruthy();
  });

  it("hides the button on an issue when its own backlog is the only place to send", async () => {
    render(
      <>
        <SendToBacklogButton issueId="t1" from={["b1"]} client={client([software])} />
        <SendToBacklogButton issueId="t2" client={client([software])} />
      </>,
    );
    await screen.findByRole("button", { name: "Send to backlog" });
    expect(screen.getAllByRole("button", { name: "Send to backlog" })).toHaveLength(1);
  });
});

describe("an opened issue after it is sent", () => {
  it("reloads and shows the new backlog", async () => {
    const reads = [issueIn("Software", "b1", "To do"), issueIn("Documentation", "b2", "Draft")];
    const issue = vi.fn().mockImplementation(async () => reads[Math.min(issue.mock.calls.length - 1, 1)]);
    const issues: BacklogsClient = { backlogs: async () => [], issues: async () => [], issue };
    vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string) =>
      tool === sendTools.move ? {} : { items: [{ id: "b1", name: "Software", issues: 1, steps: [{ id: "s1", name: "To do" }] }, { id: "b2", name: "Documentation", issues: 0, steps: [{ id: "d1", name: "Draft" }] }] }) as never);
    render(
      <MemoryRouter initialEntries={["/backlogs/issue/t1"]}>
        <Routes>
          <Route path="/backlogs/issue/:issueId" element={<IssuePage client={issues} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Software · To do/)).toBeTruthy();
    await userEvent.click(await screen.findByRole("button", { name: "Send to backlog" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByText("Documentation"));
    expect(await screen.findByText(/Documentation · Draft/)).toBeTruthy();
    expect(issue).toHaveBeenCalledTimes(2);
  });
});

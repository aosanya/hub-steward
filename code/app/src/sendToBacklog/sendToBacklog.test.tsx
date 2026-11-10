import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../agency/open";
import { taskTools } from "../backlogs/api";
import * as mcp from "../wakala/mcp";
import { mcpSendClient, sendTools, targetsOf } from "./api";
import { SelectableIssueRow } from "./SelectableIssueRow";
import { selectingShell } from "./SelectionControls";
import { useSelection } from "./selection";
import { SendSheet } from "./SendSheet";
import { SendToBacklogButton } from "./SendToBacklogButton";
import type { SendClient, Target } from "./types";
import { outcomeWords } from "./words";

const software: Target = { backlogId: "b1", name: "Software", stepId: "s1", stepName: "To do" };
const documentation: Target = { backlogId: "b2", name: "Documentation", stepId: "d1", stepName: "Draft" };

const backlogsReply = {
  items: [
    { id: "b1", name: "Software", issues: 3, steps: [{ id: "s1", name: "To do" }, { id: "s2", name: "Doing" }] },
    { id: "b2", name: "Documentation", issues: 1, steps: [{ id: "d1", name: "Draft" }] },
    { id: "b3", name: "Empty", issues: 0, steps: [] },
  ],
};

const issue = { id: "t1", title: "HS-001 Fix mirrored board drift", description: "", status: "pending", step: "To do", repo: "web", topics: [], backlog: "Software", mark: "Ready" as const, rank: 1 };

beforeEach(() => {
  vi.restoreAllMocks();
  openAgency("hub-1");
});

describe("targets", () => {
  it("lists backlogs with steps, each landing at its first step", () => {
    expect(targetsOf(backlogsReply)).toEqual([software, documentation]);
  });

  it("keeps only backlogs the person can move in when the hub says the level", () => {
    const reply = { items: [{ ...backlogsReply.items[0], level: "see" }, { ...backlogsReply.items[1], level: "move" }] };
    expect(targetsOf(reply)).toEqual([documentation]);
  });

  it("counts Can edit as Can move, since editing includes moving", () => {
    const reply = { items: [{ ...backlogsReply.items[0], level: "edit" }, { ...backlogsReply.items[1], level: "see" }] };
    expect(targetsOf(reply)).toEqual([software]);
  });
});

describe("sending", () => {
  it("moves each issue to the first step of the backlog by id", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({} as never);
    const result = await mcpSendClient.send(["t1", "t2"], software);
    expect(result).toEqual({ sent: 2, refusal: "" });
    expect(call).toHaveBeenNthCalledWith(1, "", sendTools.move, { taskID: "t1", backlog: "b1", step: "s1" });
    expect(call).toHaveBeenNthCalledWith(2, "", sendTools.move, { taskID: "t2", backlog: "b1", step: "s1" });
  });

  it("stops at the first refusal and says how many went", async () => {
    vi.spyOn(mcp, "callTool")
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new mcp.McpError("move: moving needs Can move on both backlogs"));
    const result = await mcpSendClient.send(["t1", "t2", "t3"], software);
    expect(result).toEqual({ sent: 1, refusal: "moving needs Can move on both backlogs" });
    expect(outcomeWords(result, 3, software)).toBe("1 of 3 sent to Software. moving needs Can move on both backlogs");
  });

  it("confirms in one line, singular and plural", () => {
    expect(outcomeWords({ sent: 1, refusal: "" }, 1, documentation)).toBe("1 issue sent to Documentation");
    expect(outcomeWords({ sent: 2, refusal: "" }, 2, documentation)).toBe("2 issues sent to Documentation");
  });
});

describe("selection", () => {
  it("ticks, unticks, ticks all and cancels", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.start());
    act(() => result.current.toggle("a", true));
    act(() => result.current.toggle("b", true));
    expect(result.current.count).toBe(2);
    act(() => result.current.toggle("a", false));
    expect(result.current.ids).toEqual(["b"]);
    act(() => result.current.selectAll(["a", "b", "c"]));
    expect(result.current.count).toBe(3);
    act(() => result.current.cancel());
    expect(result.current.on).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("names the top bar after the count", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.toggle("a", true));
    expect(selectingShell(result.current, ["a"])).toMatchObject({ title: "1 selected", backLabel: "Cancel" });
  });

  it("shows a tick on the issue row", async () => {
    const change = vi.fn();
    render(
      <MemoryRouter>
        <SelectableIssueRow issue={issue} chosen={[]} selection={{ checked: false, onChange: change, label: "Select HS-001" }} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Select HS-001" }));
    expect(change).toHaveBeenCalledWith(true);
  });
});

describe("the sheet", () => {
  it("lists the backlogs with where issues land and picks one", async () => {
    const pick = vi.fn();
    render(<SendSheet count={2} targets={[software, documentation]} onPick={pick} onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Send 2 issues to" })).toBeTruthy();
    expect(screen.getByText("lands at Draft")).toBeTruthy();
    await userEvent.click(screen.getByText("Documentation"));
    expect(pick).toHaveBeenCalledWith(documentation);
  });

  it("says when there is nowhere to send", () => {
    render(<SendSheet count={1} targets={[]} onPick={() => {}} onClose={() => {}} />);
    expect(screen.getByText("No backlog to send to")).toBeTruthy();
  });
});

describe("the button on an opened issue", () => {
  const clientOf = (targets: Target[], send: SendClient["send"]): SendClient => ({ targets: async () => targets, send });

  it("is not there when there is nowhere to send", async () => {
    render(<SendToBacklogButton issueId="t1" client={clientOf([], vi.fn())} />);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Send to backlog" })).toBeNull());
  });

  it("opens the sheet, sends the one issue and confirms", async () => {
    const send = vi.fn().mockResolvedValue({ sent: 1, refusal: "" });
    render(<SendToBacklogButton issueId="t1" client={clientOf([software, documentation], send)} />);
    await userEvent.click(await screen.findByRole("button", { name: "Send to backlog" }));
    await userEvent.click(screen.getByText("Documentation"));
    expect(send).toHaveBeenCalledWith(["t1"], documentation);
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "1 issue sent to Documentation");
  });

  it("reads the backlogs through the task tools", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue(backlogsReply as never);
    expect(await mcpSendClient.targets()).toEqual([software, documentation]);
    expect(call).toHaveBeenCalledWith("", taskTools.backlogs, {});
  });
});

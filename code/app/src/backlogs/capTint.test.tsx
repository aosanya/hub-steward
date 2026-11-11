import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { openAgency } from "../agency/open";
import { IssuePage } from "./IssuePage";
import { IssueRow } from "./IssueRow";
import type { BacklogsClient, Issue, IssueDetail } from "./api";
import type { CapsClient, CapsReading } from "./caps/api";
import { capsRefreshMs } from "./caps/useCapTint";

const caps = { input: 1000, output: 400, runtimeSeconds: 900 };

const reading = (seconds: number): CapsReading => ({ inForce: caps, standard: caps, own: null, used: { input: 0, output: 0, seconds, clockStopped: false } });

const clientAt = (seconds: number[]): CapsClient & { read: ReturnType<typeof vi.fn> } => {
  let at = 0;
  const read = vi.fn(async () => reading(seconds[Math.min(at++, seconds.length - 1)]));
  return { read, set: async () => reading(0), clear: async () => reading(0) };
};

const issue = (over: Partial<Issue> = {}): Issue => ({
  id: "1",
  title: "ISS-48 Red card",
  description: "Text",
  status: "in_progress",
  step: "In Progress",
  repo: "hub-steward-swe",
  topics: [],
  backlog: "Backlog",
  mark: "Ready",
  rank: 1,
  ...over,
});

beforeEach(() => openAgency({ id: "hub-1", name: "Hub" } as never));

afterEach(() => vi.useRealTimers());

describe("an issue row turns red as its worker nears a cap", () => {
  it("tints a row in progress and names the cap in a chip", async () => {
    render(<IssueRow issue={issue()} chosen={[]} capsClient={clientAt([720])} />);
    expect(await screen.findByText("Runtime 80%")).toBeInTheDocument();
    const row = document.querySelector(".issue-row") as HTMLElement;
    expect(row).toHaveClass("capped");
    expect(row.style.getPropertyValue("--cap-tint")).toBe("0.68");
  });

  it("shows no tint below half used", async () => {
    const client = clientAt([100]);
    render(<IssueRow issue={issue()} chosen={[]} capsClient={client} />);
    await vi.waitFor(() => expect(client.read).toHaveBeenCalled());
    expect(document.querySelector(".issue-row")).not.toHaveClass("capped");
  });

  it("reads nothing for an issue that is to do, done or cancelled", () => {
    const client = clientAt([900]);
    render(
      <>
        <IssueRow issue={issue({ id: "2", status: "pending", step: "To do" })} chosen={[]} capsClient={client} />
        <IssueRow issue={issue({ id: "3", status: "completed", step: "Done" })} chosen={[]} capsClient={client} />
        <IssueRow issue={issue({ id: "4", status: "cancelled", step: "Cancelled", topics: ["Sinbin"] })} chosen={[]} capsClient={client} />
      </>,
    );
    expect(client.read).not.toHaveBeenCalled();
  });

  it("keeps the last run's tint on a Sinbin issue that sits in to do", async () => {
    render(<IssueRow issue={issue({ status: "pending", step: "To do", topics: ["Sinbin"] })} chosen={[]} capsClient={clientAt([900])} />);
    expect(await screen.findByText("Runtime passed")).toBeInTheDocument();
    expect(document.querySelector(".issue-row")).toHaveClass("capped");
  });

  it("refreshes every 15 seconds while the worker runs", async () => {
    vi.useFakeTimers();
    const client = clientAt([450, 720]);
    render(<IssueRow issue={issue()} chosen={[]} capsClient={client} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Runtime 50%")).toBeInTheDocument();
    expect(capsRefreshMs).toBe(15000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(capsRefreshMs);
    });
    expect(screen.getByText("Runtime 80%")).toBeInTheDocument();
    expect((document.querySelector(".issue-row") as HTMLElement).style.getPropertyValue("--cap-tint")).toBe("0.68");
  });

  it("does not refresh a stopped issue", async () => {
    vi.useFakeTimers();
    const client = clientAt([900]);
    render(<IssueRow issue={issue({ status: "pending", step: "To do", topics: ["Sinbin"] })} chosen={[]} capsClient={client} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(capsRefreshMs * 3);
    });
    expect(client.read).toHaveBeenCalledTimes(1);
  });
});

describe("the issue page header turns red the same way", () => {
  const one = issue();
  const detail: IssueDetail = { ...one, waitsOn: [], waitedOnBy: [] };
  const backlogs: BacklogsClient = { backlogs: async () => [], issues: async () => [one], issue: async () => detail };

  it("tints the header card and shows the chip", async () => {
    render(
      <MemoryRouter initialEntries={["/a/hub-1/backlogs/issue/1"]}>
        <Routes>
          <Route path="/a/:agencyId/backlogs/issue/:issueId" element={<IssuePage client={backlogs} capsClient={clientAt([720])} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect((await screen.findAllByText("Runtime 80%")).length).toBeGreaterThan(0);
    const header = document.querySelector(".cap-tinted") as HTMLElement;
    expect(header.style.getPropertyValue("--cap-tint")).toBe("0.68");
    expect(header.querySelector(".issue-title")).not.toBeNull();
  });
});

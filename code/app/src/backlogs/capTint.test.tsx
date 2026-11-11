import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { openAgency } from "../agency/open";
import { BacklogBoard } from "../backlogBoard/BacklogBoard";
import { IssuePage } from "./IssuePage";
import { IssuesPage } from "./IssuesPage";
import { IssueRow } from "./IssueRow";
import type { Backlog, BacklogsClient, Issue, IssueDetail } from "./api";
import type { CapsClient, CapsReading } from "./caps/api";
import type { CapKey } from "./caps/capsFigures";
import { CapTintScope } from "./caps/CapTintScope";
import { capsRefreshMs } from "./caps/useCapTints";

const caps = { input: 1000, output: 400, runtimeSeconds: 900 };

const reading = (seconds: number): CapsReading => ({ inForce: caps, standard: caps, own: null, used: { input: 0, output: 0, seconds, clockStopped: false } });

type Spent = Record<string, { key: CapKey; ratio: number }>;

const clientAt = (rounds: Spent[]): CapsClient & { nearest: ReturnType<typeof vi.fn>; read: ReturnType<typeof vi.fn> } => {
  let at = 0;
  const nearest = vi.fn(async (ids: string[]) => {
    const round = rounds[Math.min(at++, rounds.length - 1)];
    return Object.fromEntries(ids.filter((id) => round[id]).map((id) => [id, { ...round[id], used: 0, cap: 0 }]));
  });
  const read = vi.fn(async () => reading(0));
  return { nearest, read, set: async () => reading(0), clear: async () => reading(0) };
};

const runtime = (ratio: number) => ({ key: "runtimeSeconds" as CapKey, ratio });

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

const list = (issues: Issue[], client: CapsClient) => (
  <CapTintScope issues={issues} client={client}>
    {issues.map((one) => (
      <IssueRow key={one.id} issue={one} chosen={[]} />
    ))}
  </CapTintScope>
);

const rowOf = (id: string) => document.querySelectorAll(".issue-row")[Number(id) - 1] as HTMLElement;

beforeEach(() => openAgency({ id: "hub-1", name: "Hub" } as never));

afterEach(() => vi.useRealTimers());

describe("a board or list turns its cards red from one read of the nearest cap", () => {
  it("tints a row in progress and names the cap in a chip", async () => {
    render(list([issue()], clientAt([{ 1: runtime(0.8) }])));
    expect(await screen.findByText("Runtime 80%")).toBeInTheDocument();
    const row = rowOf("1");
    expect(row).toHaveClass("capped");
    expect(row.style.getPropertyValue("--cap-tint")).toBe("0.68");
  });

  it("asks once for every card that holds figures and tints each from the one answer", async () => {
    const client = clientAt([{ 1: runtime(0.5), 3: { key: "input", ratio: 1.4 }, 4: runtime(0.9) }]);
    render(
      list(
        [
          issue({ id: "1" }),
          issue({ id: "2", status: "pending", step: "To do" }),
          issue({ id: "3", status: "pending", step: "To do", topics: ["Sinbin"] }),
          issue({ id: "4", status: "in_progress" }),
          issue({ id: "5", status: "completed", step: "Done" }),
        ],
        client,
      ),
    );
    expect(await screen.findByText("Input passed")).toBeInTheDocument();
    expect(client.nearest).toHaveBeenCalledTimes(1);
    expect(client.nearest).toHaveBeenCalledWith(["1", "3", "4"]);
    expect(client.read).not.toHaveBeenCalled();
    expect(rowOf("1").style.getPropertyValue("--cap-tint")).toBe("0.2");
    expect(rowOf("2")).not.toHaveClass("capped");
    expect(rowOf("3").style.getPropertyValue("--cap-tint")).toBe("1");
    expect(rowOf("4").style.getPropertyValue("--cap-tint")).toBe("0.84");
    expect(rowOf("5")).not.toHaveClass("capped");
  });

  it("shows no tint below half used", async () => {
    const client = clientAt([{ 1: runtime(0.1) }]);
    render(list([issue()], client));
    await vi.waitFor(() => expect(client.nearest).toHaveBeenCalled());
    expect(rowOf("1")).not.toHaveClass("capped");
  });

  it("shows no tint where no worker has run", async () => {
    const client = clientAt([{}]);
    render(list([issue()], client));
    await vi.waitFor(() => expect(client.nearest).toHaveBeenCalled());
    expect(rowOf("1")).not.toHaveClass("capped");
  });

  it("asks nothing for cards that are to do, done or cancelled", () => {
    const client = clientAt([{}]);
    render(
      list(
        [
          issue({ id: "2", status: "pending", step: "To do" }),
          issue({ id: "3", status: "completed", step: "Done" }),
          issue({ id: "4", status: "cancelled", step: "Cancelled", topics: ["Sinbin"] }),
        ],
        client,
      ),
    );
    expect(client.nearest).not.toHaveBeenCalled();
  });

  it("keeps the last run's tint on a Sinbin card that sits in to do", async () => {
    render(list([issue({ status: "pending", step: "To do", topics: ["Sinbin"] })], clientAt([{ 1: runtime(1.2) }])));
    expect(await screen.findByText("Runtime passed")).toBeInTheDocument();
    expect(rowOf("1")).toHaveClass("capped");
  });

  it("refreshes the one read every 15 seconds while a card is in progress", async () => {
    vi.useFakeTimers();
    const client = clientAt([{ 1: runtime(0.5) }, { 1: runtime(0.8) }]);
    render(list([issue()], client));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Runtime 50%")).toBeInTheDocument();
    expect(capsRefreshMs).toBe(15000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(capsRefreshMs);
    });
    expect(screen.getByText("Runtime 80%")).toBeInTheDocument();
    expect(rowOf("1").style.getPropertyValue("--cap-tint")).toBe("0.68");
    expect(client.nearest).toHaveBeenCalledTimes(2);
  });

  it("does not refresh when every card with figures is stopped", async () => {
    vi.useFakeTimers();
    const client = clientAt([{ 1: runtime(1.1) }]);
    render(list([issue({ status: "pending", step: "To do", topics: ["Sinbin"] })], client));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(capsRefreshMs * 3);
    });
    expect(client.nearest).toHaveBeenCalledTimes(1);
  });

  it("does not ask again when the same cards are drawn again", async () => {
    const client = clientAt([{ 1: runtime(0.8) }]);
    const view = render(list([issue()], client));
    await screen.findByText("Runtime 80%");
    view.rerender(list([issue({ title: "Renamed" })], client));
    expect(client.nearest).toHaveBeenCalledTimes(1);
  });

  it("shows no tint on a row outside a board or list", () => {
    render(<IssueRow issue={issue()} chosen={[]} />);
    expect(rowOf("1")).not.toHaveClass("capped");
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
          <Route path="/a/:agencyId/backlogs/issue/:issueId" element={<IssuePage client={backlogs} capsClient={{ ...clientAt([{}]), read: async () => reading(720) }} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect((await screen.findAllByText("Runtime 80%")).length).toBeGreaterThan(0);
    const header = document.querySelector(".cap-tinted") as HTMLElement;
    expect(header.style.getPropertyValue("--cap-tint")).toBe("0.68");
    expect(header.querySelector(".issue-title")).not.toBeNull();
  });
});

describe("the board and the list page read once for the whole screen", () => {
  const stopped = issue({ id: "1", title: "Stopped", status: "pending", step: "To do", topics: ["Sinbin"] });
  const running = issue({ id: "2", title: "Running", step: "Doing" });
  const idle = issue({ id: "3", title: "Idle", status: "pending", step: "To do" });
  const backlog: Backlog = { id: "default", name: "Software", steps: ["To do", "Doing", "Done"], issues: 3 };
  const backlogs: BacklogsClient = { backlogs: async () => [backlog], issues: async () => [stopped, running, idle], issue: async () => ({ ...stopped, waitsOn: [], waitedOnBy: [] }) };
  const manage = { mayManage: async () => false } as never;

  it("tints a stopped card in the To do column of the board from the one call", async () => {
    const client = clientAt([{ 1: runtime(1.3), 2: runtime(0.6) }]);
    render(
      <MemoryRouter initialEntries={["/a/hub-1/backlogs/default/board"]}>
        <Routes>
          <Route path="/a/hub-1/backlogs/:backlogId/board" element={<BacklogBoard client={backlogs} capsClient={client} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Runtime passed")).toBeInTheDocument();
    expect(screen.getByText("Runtime 60%")).toBeInTheDocument();
    expect(client.nearest).toHaveBeenCalledTimes(1);
    expect(client.nearest).toHaveBeenCalledWith(["1", "2"]);
    expect(client.read).not.toHaveBeenCalled();
  });

  it("tints the rows of the issues list from the one call", async () => {
    const client = clientAt([{ 1: runtime(1.3), 2: runtime(0.6) }]);
    render(
      <MemoryRouter initialEntries={["/a/hub-1/backlogs/default/issues"]}>
        <Routes>
          <Route path="/a/hub-1/backlogs/:backlogId/issues" element={<IssuesPage client={backlogs} manage={manage} smartBacklogs={async () => []} capsClient={client} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Runtime passed")).toBeInTheDocument();
    expect(screen.getByText("Runtime 60%")).toBeInTheDocument();
    expect(client.nearest).toHaveBeenCalledTimes(1);
    expect(client.read).not.toHaveBeenCalled();
  });
});

import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Backlog, BacklogsClient, Issue } from "../shared/api";
import { BacklogBoard } from "./BacklogBoard";

const columnsDrawn = vi.hoisted(() => vi.fn());

vi.mock("./BoardColumns", async () => {
  const actual = await vi.importActual<typeof import("./BoardColumns")>("./BoardColumns");
  return {
    BoardColumns: (props: Parameters<typeof actual.BoardColumns>[0]) => {
      columnsDrawn();
      return actual.BoardColumns(props);
    },
  };
});

const issue = (id: string, title: string, step: string): Issue => ({
  id,
  title,
  description: "",
  status: "pending",
  step,
  repo: "hub-steward",
  topics: [],
  backlog: "Backlog",
  mark: "Ready",
  rank: 1,
});

const backlog: Backlog = { id: "default", name: "Software", steps: ["To do", "Doing", "Done"], issues: 2 };

const clientOver = (reads: Issue[][]): BacklogsClient & { calls: () => number } => {
  let calls = 0;
  return {
    backlogs: async () => [backlog],
    issues: async () => reads[Math.min(calls++, reads.length - 1)].map((each) => ({ ...each })),
    issue: async () => {
      throw new Error("unused");
    },
    calls: () => calls,
  };
};

const open = (client: BacklogsClient, at = "/a/x/backlogs/default/board") =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/a/x/backlogs/:backlogId/board" element={<BacklogBoard client={client} />} />
      </Routes>
    </MemoryRouter>,
  );

const settle = async (milliseconds = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
};

const column = (name: string) => screen.getByRole("region", { name });

const first = [issue("1", "Record the clips", "To do"), issue("2", "Fix the import route", "Doing")];
const moved = [issue("1", "Record the clips", "Doing"), issue("2", "Fix the import route", "Doing")];
const importDone = [issue("1", "Record the clips", "Doing"), issue("2", "Fix the import route", "Done")];

describe("the board reads again by itself", () => {
  beforeEach(() => {
    columnsDrawn.mockClear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("shows a card that moved after 15 seconds without a loading line", async () => {
    open(clientOver([first, moved]));
    await settle();
    expect(column("To do")).toHaveTextContent("Record the clips");
    await settle(15000);
    expect(column("Doing")).toHaveTextContent("Record the clips");
    expect(screen.queryByText("Loading")).toBeNull();
  });

  it("does not read before 15 seconds have passed", async () => {
    const client = clientOver([first, moved]);
    open(client);
    await settle();
    await settle(14000);
    expect(client.calls()).toBe(1);
  });

  it("reads again when the window is focused", async () => {
    const client = clientOver([first, moved]);
    open(client);
    await settle();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await settle();
    expect(client.calls()).toBe(2);
    expect(column("Doing")).toHaveTextContent("Record the clips");
  });

  it("reads again when the tab is shown", async () => {
    const client = clientOver([first, moved]);
    open(client);
    await settle();
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await settle();
    expect(client.calls()).toBe(2);
  });

  it("does not draw the board again when nothing changed", async () => {
    const client = clientOver([first]);
    open(client);
    await settle();
    const before = columnsDrawn.mock.calls.length;
    await settle(15000);
    expect(client.calls()).toBe(2);
    expect(columnsDrawn.mock.calls.length).toBe(before);
  });

  it("keeps the words typed in the search", async () => {
    open(clientOver([first, importDone]), "/a/x/backlogs/default/board?q=import");
    await settle();
    expect(screen.queryByText("Record the clips")).toBeNull();
    await settle(15000);
    expect(column("Done")).toHaveTextContent("Fix the import route");
    expect(screen.queryByText("Record the clips")).toBeNull();
    expect(screen.getByRole("searchbox")).toHaveValue("import");
  });

  it("stops reading when the board is closed", async () => {
    const client = clientOver([first, moved]);
    const view = open(client);
    await settle();
    view.unmount();
    await settle(60000);
    expect(client.calls()).toBe(1);
  });
});

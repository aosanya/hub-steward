import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { AgencyView } from "../agency/modules";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { Backlog } from "../backlogs/api";
import type { StartStep } from "../coordinator/start/api";
import type { MemberStep } from "../steps/api";
import { forgetLastBacklogs, rememberBacklog } from "./lastBacklog";
import { HomeOptions } from "./HomeOptions";

const step = { id: "s1", title: "Report", formName: "Report", roleName: "Farmer", workflowName: "", agencyName: "Alego", questions: [], state: "start", orderId: "o1", recordCode: "R1" } as MemberStep;

const backlog = (id: string, name: string, over: Partial<Backlog> = {}): Backlog => ({ id, name, steps: ["to-do", "done"], issues: 2, ...over });

type Setup = { codes?: string[]; unread?: boolean; open?: StartStep[]; available?: MemberStep[]; backlogs?: Backlog[]; backlogsFail?: boolean; agencyFail?: boolean };

const view = ({ codes = ["taskmanager"], unread = false }: Setup): AgencyView => ({ name: "Alego", modules: codes.map((code) => ({ code, name: code })), ...(unread ? { modulesUnread: true } : {}) });

let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const show = (setup: Setup = {}) =>
  render(
    <MemoryRouter initialEntries={["/a/alego/home"]}>
      <HomeOptions
        agency={{ read: async () => (setup.agencyFail ? Promise.reject(new Error("no")) : view(setup)) }}
        start={{ openSteps: async () => setup.open ?? [] }}
        steps={{ available: async () => (setup.available ?? []) as never[] }}
        backlogs={{
          backlogs: async () => {
            if (setup.backlogsFail) throw new Error("no");
            return setup.backlogs ?? [];
          },
        } as never}
      />
      <Where />
    </MemoryRouter>,
  );

const titles = () => screen.getAllByRole("button").map((button) => button.querySelector(".ttl")?.textContent);

beforeEach(() => {
  openAgency("alego");
  forgetLastBacklogs();
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetLastBacklogs();
});

describe("Home options", () => {
  it("lists Start, Ongoing and Backlogs in that order when the role has workflows and a backlog", async () => {
    show({ open: [step], backlogs: [backlog("b1", "Backlog")] });
    await screen.findByText("Backlogs");
    expect(titles()).toEqual(["Start", "Ongoing", "Backlogs"]);
  });

  it("draws each option as its own row with the play, clock and list icon and a chevron, and no subtitle or count", async () => {
    show({ open: [step], backlogs: [backlog("b1", "Backlog")] });
    await screen.findByText("Backlogs");
    const rows = screen.getAllByRole("button");
    expect(rows.map((row) => row.querySelector("svg")?.getAttribute("data-icon"))).toEqual(["play", "clock", "list"]);
    rows.forEach((row) => {
      expect(row.querySelector(".end")?.textContent).toBe("›");
      expect(row.querySelector(".meta")).toBeNull();
    });
  });

  it("opens the Start, Ongoing and Backlogs pages of the open agency", async () => {
    const user = userEvent.setup();
    show({ open: [step], backlogs: [backlog("b1", "Backlog")] });
    await user.click(await screen.findByRole("button", { name: "Start" }));
    expect(landed).toBe("/a/alego/do-something");
    await user.click(screen.getByRole("button", { name: "Ongoing" }));
    expect(landed).toBe("/a/alego/ongoing");
    await user.click(screen.getByRole("button", { name: "Backlogs" }));
    expect(landed).toBe("/a/alego/backlogs");
  });

  it.each([
    ["open steps", { open: [step] }],
    ["steps she can start", { available: [step] }],
  ])("shows Start and Ongoing when the role has %s", async (_name, setup) => {
    show({ ...setup, codes: [] });
    await screen.findByText("Start");
    expect(titles()).toEqual(["Start", "Ongoing"]);
  });

  it("leaves out Start and Ongoing when the role has no workflows", async () => {
    show({ backlogs: [backlog("b1", "Backlog"), backlog("b2", "Other")] });
    await screen.findByText("Backlog");
    expect(screen.queryByText("Start")).not.toBeInTheDocument();
    expect(screen.queryByText("Ongoing")).not.toBeInTheDocument();
  });

  it("leaves out Backlogs when the agency has no taskmanager module, even if backlogs can be read", async () => {
    show({ codes: ["market"], open: [step], backlogs: [backlog("b1", "Backlog")] });
    await screen.findByText("Start");
    await waitFor(() => expect(titles()).toEqual(["Start", "Ongoing"]));
  });

  it("leaves out Backlogs when the member can see no backlog, without a failure line", async () => {
    show({ open: [step], backlogs: [] });
    await screen.findByText("Start");
    expect(titles()).toEqual(["Start", "Ongoing"]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["the backlogs cannot be read", { backlogsFail: true }],
    ["the agency's modules could not be read", { unread: true, backlogs: [backlog("b1", "Backlog")] }],
    ["the agency cannot be read", { agencyFail: true }],
  ] as [string, Setup][])("says Backlogs could not be loaded, with Try again, when %s, and keeps Start and Ongoing", async (_name, setup) => {
    show({ open: [step], ...setup });
    expect(await screen.findByRole("alert")).toHaveTextContent("Backlogs could not be loaded.");
    expect(titles().slice(0, 2)).toEqual(["Start", "Ongoing"]);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("says Start and Ongoing could not be loaded when both workflow reads fail, never that there are none", async () => {
    render(
      <MemoryRouter>
        <HomeOptions agency={{ read: async () => view({}) }} start={{ openSteps: async () => Promise.reject(new Error("no")) }} steps={{ available: async () => Promise.reject(new Error("no")) }} backlogs={{ backlogs: async () => [] } as never} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Start and Ongoing could not be loaded.");
  });

  it("reads Backlogs again on Try again and then draws the card", async () => {
    const user = userEvent.setup();
    let down = true;
    const read = vi.fn(async () => (down ? Promise.reject(new Error("no")) : [backlog("b1", "Backlog")]));
    render(
      <MemoryRouter>
        <HomeOptions agency={{ read: async () => view({}) }} start={{ openSteps: async () => [step] }} steps={{ available: async () => [] }} backlogs={{ backlogs: read } as never} />
      </MemoryRouter>,
    );
    await screen.findByRole("alert");
    down = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Backlogs");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("shows nothing when the agency has neither workflows nor backlogs", async () => {
    const { container } = show({ codes: [] });
    await waitFor(() => expect(container.querySelector(".rows")).toBeNull());
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("lists the backlogs themselves for a role that only uses backlogs, the last one opened first", async () => {
    rememberBacklog("b2");
    show({ backlogs: [backlog("b1", "First"), backlog("b2", "Second"), backlog("b3", "Third")] });
    await screen.findByText("Second");
    expect(titles()).toEqual(["Second", "First", "Third"]);
  });

  it("keeps the order the hub gives when no backlog was opened, and opens a backlog's board or smart page", async () => {
    const user = userEvent.setup();
    show({ backlogs: [backlog("b1", "First"), backlog("s1", "Ready ones", { kind: "smart" })] });
    await screen.findByText("First");
    expect(titles()).toEqual(["First", "Ready ones"]);
    await user.click(screen.getByRole("button", { name: "First" }));
    expect(landed).toBe("/a/alego/backlogs/b1/board");
    await user.click(screen.getByRole("button", { name: "Ready ones" }));
    expect(landed).toBe("/a/alego/backlogs/s1/smart");
  });

  it("remembers the backlog opened from Home as the one to list first next time", async () => {
    const user = userEvent.setup();
    show({ backlogs: [backlog("b1", "First"), backlog("b2", "Second")] });
    await user.click(await screen.findByRole("button", { name: "Second" }));
    cleanup();
    show({ backlogs: [backlog("b1", "First"), backlog("b2", "Second")] });
    await screen.findByText("Second");
    expect(titles()).toEqual(["Second", "First"]);
  });
});

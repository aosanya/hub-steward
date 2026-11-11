import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { openAgency } from "../agency/open";
import { textLook } from "../ui/textColor";
import { IssuePage } from "./IssuePage";
import type { Backlog, BacklogsClient, Issue, IssueDetail } from "./api";

const issue = (id: string, title: string, over: Partial<Issue> = {}): Issue => ({
  id,
  title,
  description: "Text",
  status: "pending",
  step: "To do",
  repo: "hub-steward",
  topics: [],
  backlog: "Backlog",
  mark: "",
  rank: 1,
  ...over,
});

const finished = issue("2", "DEV-010 Fix the route", { status: "completed", step: "Done" });
const underway = issue("3", "DEV-011 Wire the page", { status: "in_progress", step: "Doing" });
const follower = issue("4", "DEV-012 Follow up", { step: "To do" });
const detail: IssueDetail = { ...issue("1", "DEV-009 Create the tables"), waitsOn: [finished, underway], waitedOnBy: [follower] };
const backlog: Backlog = { id: "backlog", name: "Backlog", steps: ["To do", "Doing", "Done"], issues: 4 };
const client: BacklogsClient = { backlogs: async () => [backlog], issues: async () => [], issue: async () => detail };

const rowOf = (code: string) => screen.getByText(code).closest(".issue-row") as HTMLElement;

beforeEach(() => {
  openAgency({ id: "hub-1", name: "Hub" } as never);
  render(
    <MemoryRouter initialEntries={["/a/hub-1/backlogs/issue/1"]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/issue/:issueId" element={<IssuePage client={client} />} />
      </Routes>
    </MemoryRouter>,
  );
});

describe("each issue in the Waits on card shows its current step", () => {
  it("a dependency in Done shows Done and one in Doing shows Doing", async () => {
    await screen.findByText("Waits on");
    expect(within(rowOf("DEV-010")).getByText("Done")).toBeInTheDocument();
    expect(within(rowOf("DEV-011")).getByText("Doing")).toBeInTheDocument();
  });

  it("the step bubble wears the colour the board gives that step name", async () => {
    await screen.findByText("Waits on");
    const bubble = within(rowOf("DEV-010")).getByText("Done");
    const { hue, shade } = textLook("Done") as { hue: number; shade: number };
    expect(bubble).toHaveClass("hued");
    expect(bubble.style.getPropertyValue("--hue")).toBe(String(hue));
    expect(bubble.style.getPropertyValue("--shade")).toBe(String(shade));
  });

  it("the card of the issues that wait on this one shows their step too", async () => {
    await screen.findByText("Waited on by");
    expect(within(rowOf("DEV-012")).getByText("To do")).toBeInTheDocument();
  });

  it("the page's own top row does not gain a second step bubble", async () => {
    await screen.findByText("Waits on");
    expect(within(document.querySelector(".issue-row.static") as HTMLElement).queryAllByText("To do")).toHaveLength(0);
  });
});

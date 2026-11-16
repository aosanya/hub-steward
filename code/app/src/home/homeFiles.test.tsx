import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { AgencyView } from "../features/agency/modules";
import { forgetOpenAgency, openAgency } from "../features/agency/open";
import type { Backlog } from "../features/backlogs/shared/api";
import type { StartStep } from "../features/market/start/api";
import type { MemberStep } from "../features/steps/api";
import { forgetLastBacklogs } from "./lastBacklog";
import { HomeOptions } from "./HomeOptions";

const step = { id: "s1", title: "Report", formName: "Report", roleName: "Farmer", workflowName: "", agencyName: "Alego", questions: [], state: "start", orderId: "o1", recordCode: "R1", earlier: [] } as MemberStep;

const backlog: Backlog = { id: "b1", name: "Backlog", steps: ["to-do", "done"], issues: 2 };

const view: AgencyView = { name: "Alego", modules: [{ code: "taskmanager", name: "taskmanager" }] };

type Setup = { mounted?: () => Promise<boolean>; workflows?: boolean; backlogs?: boolean };

let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const show = ({ mounted = async () => true, workflows = true, backlogs = true }: Setup = {}) => {
  const files = { mounted: vi.fn(mounted) };
  render(
    <MemoryRouter initialEntries={["/a/alego/home"]}>
      <HomeOptions
        agency={{ read: async () => view }}
        start={{ openSteps: async () => (workflows ? [step as unknown as StartStep] : []) }}
        steps={{ available: async () => [] }}
        backlogs={{ backlogs: async () => (backlogs ? [backlog] : []) } as never}
        mayRead={async () => true}
        files={files}
      />
      <Where />
    </MemoryRouter>,
  );
  return files;
};

const titles = () => screen.queryAllByRole("button").map((button) => button.querySelector(".ttl")?.textContent);

beforeEach(() => {
  openAgency("alego");
  forgetLastBacklogs();
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetLastBacklogs();
});

describe("the Files option on Home", () => {
  it("sits after Start, Ongoing and Backlogs when the agency mounts git", async () => {
    show();
    await screen.findByText("Files");
    expect(titles()).toEqual(["Start", "Ongoing", "Backlogs", "Files"]);
  });

  it("draws Files as a row with a chevron and no subtitle", async () => {
    show();
    const row = (await screen.findByText("Files")).closest("button") as HTMLElement;
    expect(row.querySelector(".end")?.textContent).toBe("›");
    expect(row.querySelector(".meta")).toBeNull();
  });

  it("opens the Folders list of the open agency", async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("button", { name: "Files" }));
    expect(landed).toBe("/a/alego/files");
  });

  it("is the only option for a member with no workflows and no backlogs", async () => {
    show({ workflows: false, backlogs: false });
    await screen.findByText("Files");
    expect(titles()).toEqual(["Files"]);
  });

  it("is asked about once", async () => {
    const files = show();
    await screen.findByText("Files");
    expect(files.mounted).toHaveBeenCalledTimes(1);
  });

  it("is left out when the agency does not mount git, without a failure line", async () => {
    const files = show({ mounted: async () => false });
    await screen.findByText("Start");
    await waitFor(() => expect(files.mounted).toHaveBeenCalled());
    expect(titles()).toEqual(["Start", "Ongoing", "Backlogs"]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("is left out, without a failure line, when the check fails", async () => {
    const files = show({ mounted: async () => Promise.reject(new Error("down")) });
    await screen.findByText("Start");
    await waitFor(() => expect(files.mounted).toHaveBeenCalled());
    expect(titles()).toEqual(["Start", "Ongoing", "Backlogs"]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows nothing at all when git is not mounted and the member has no workflows or backlogs", async () => {
    const files = show({ mounted: async () => false, workflows: false, backlogs: false });
    await waitFor(() => expect(files.mounted).toHaveBeenCalled());
    expect(titles()).toEqual([]);
  });
});

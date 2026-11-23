import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { StartRows } from "../../app/home/StartRows";
import { routes } from "../../app/routes";
import type { MemberStep, StepsClient } from "./api";
import { forgetSent } from "./sent";
import { StepPage } from "./StepPage";

const behalf = "On whose behalf did we record the response?";
const completed = "Did we complete the step?";

const recording: MemberStep = {
  id: "s8",
  title: "Record the paper answers",
  formName: "Paper answers",
  roleName: "District clerk",
  workflowName: "Paper round",
  opensIn: "form",
  agencyName: "",
  state: "start",
  orderId: "",
  recordCode: "REC-8",
  earlier: [],
  questions: [
    { prompt: behalf, answerType: "free_text", helper: "", required: true },
    { prompt: completed, answerType: "free_text", helper: "", required: true },
  ],
};

const reviewer: MemberStep = { ...recording, id: "s9", formName: "Review", roleName: "Coordinator", state: "waiting", orderId: "o1" };

let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return <p>elsewhere</p>;
};

const openPage = async (submit: StepsClient["submit"], state?: unknown) => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: routes.step.path({ stepId: "s8" }), state }]}>
        <Routes>
          <Route path={routes.step.pattern} element={<StepPage steps={{ available: async () => [recording], submit }} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

const sheet = async (who: string) => {
  await userEvent.type(screen.getByLabelText(behalf), who);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

const showRows = async () => {
  await act(async () => {
    render(
      <MemoryRouter>
        <StartRows
          kind="farmers"
          start={{ openSteps: async () => [], waiting: async () => [] }}
          steps={{ available: async () => [] }}
          forms={{ waiting: async () => [], answered: async () => [] }}
        />
      </MemoryRouter>,
    );
  });
};

beforeEach(() => openAgency("farmers"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetSent();
});

describe("a record step takes sheet after sheet on one page", () => {
  it("sends three sheets, reads 3, and shows the Next line only after Finished", async () => {
    const submit = vi.fn<StepsClient["submit"]>(async () => ({ done: false, next: reviewer, orderId: "o1" }));
    await openPage(submit);
    await userEvent.type(screen.getByLabelText(completed), "Yes");

    await sheet("Anna");
    expect(await screen.findByText("Sheets recorded: 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add another sheet" }));
    expect(screen.getByLabelText(behalf)).toHaveValue("");
    expect(screen.getByLabelText(completed)).toHaveValue("Yes");

    await sheet("Bela");
    expect(await screen.findByText("Sheets recorded: 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add another sheet" }));

    await sheet("Csilla");
    expect(await screen.findByText("Sheets recorded: 3")).toBeInTheDocument();
    expect(screen.queryByText(/Next:/)).not.toBeInTheDocument();
    expect(landed).toBe("");

    const keys = submit.mock.calls.map((call) => call[2]);
    expect(new Set(keys).size).toBe(3);
    expect(submit.mock.calls.map((call) => call[3])).toEqual([undefined, { orderId: "o1" }, { orderId: "o1" }]);
    expect(submit.mock.calls.map((call) => call[1][behalf])).toEqual(["Anna", "Bela", "Csilla"]);

    await userEvent.click(screen.getByRole("button", { name: "Finished" }));
    expect(landed).toBe("/a/farmers/do-something");
    cleanup();
    await showRows();
    const row = (await screen.findByText("Paper answers")).closest(".row")!;
    expect(row).toHaveTextContent("Next: Coordinator");
  });

  it("lands on the screen it was opened from after Finished", async () => {
    const submit = vi.fn<StepsClient["submit"]>(async () => ({ done: false, next: reviewer, orderId: "o1" }));
    await openPage(submit, { from: { path: "/a/farmers/home/rounds", title: "Rounds" } });
    await userEvent.type(screen.getByLabelText(completed), "Yes");
    await sheet("Anna");
    await screen.findByText("Sheets recorded: 1");
    await userEvent.click(screen.getByRole("button", { name: "Finished" }));
    expect(landed).toBe("/a/farmers/home/rounds");
  });

  it("leaves a step with no On whose behalf question as it was, going back after Send", async () => {
    const submit = vi.fn<StepsClient["submit"]>(async () => ({ done: true, next: null, orderId: "o1" }));
    await act(async () => {
      render(
        <MemoryRouter initialEntries={[routes.step.path({ stepId: "s8" })]}>
          <Routes>
            <Route
              path={routes.step.pattern}
              element={<StepPage steps={{ available: async () => [{ ...recording, questions: [recording.questions[1]] }], submit }} />}
            />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await userEvent.type(screen.getByLabelText(completed), "Yes");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("elsewhere");
    expect(screen.queryByText(/Sheets recorded/)).not.toBeInTheDocument();
  });
});

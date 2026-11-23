import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { routes } from "../../app/routes";
import type { MemberStep, StepsClient } from "./api";
import { forgetSent } from "./sent";
import { StepPage } from "./StepPage";

const goNoGo: MemberStep = {
  id: "s1",
  title: "Go or no-go",
  formName: "Go or no-go",
  roleName: "Tender Scout",
  workflowName: "Go or no-go",
  opensIn: "form",
  agencyName: "",
  state: "start",
  orderId: "",
  earlier: [],
  questions: [{ prompt: "Decision", answerType: "free_text", helper: "", required: true }],
};

let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return <p>elsewhere</p>;
};

const client: StepsClient = { available: async () => [goNoGo], submit: vi.fn(async () => ({ done: true, next: null, orderId: "", rowId: "" })) };

const show = async (state?: unknown) => {
  landed = "";
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: routes.step.path({ stepId: "s1" }), state }]}>
        <Routes>
          <Route path={routes.step.pattern} element={<StepPage steps={client} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

const fromTenders = { from: { path: "/a/ias/home/tenders", title: "Tenders" } };

beforeEach(() => openAgency("ias"));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  forgetOpenAgency();
  forgetSent();
  window.localStorage.clear();
});

describe("a step page of a workflow opened from a section", () => {
  it("reads Back with the section's title and goes to the section", async () => {
    await show(fromTenders);
    await userEvent.click(screen.getByRole("button", { name: "‹ Tenders" }));
    expect(landed).toBe("/a/ias/home/tenders");
  });

  it("lands on the section after Send", async () => {
    await show(fromTenders);
    await userEvent.type(screen.getByLabelText("Decision"), "Go");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(landed).toBe("/a/ias/home/tenders"));
  });
});

describe("a step page opened with no origin", () => {
  it("reads Back with the last side tab reached, Start, and goes there", async () => {
    await show();
    await userEvent.click(screen.getByRole("button", { name: "‹ Start" }));
    expect(landed).toBe("/a/ias/do-something");
  });
});

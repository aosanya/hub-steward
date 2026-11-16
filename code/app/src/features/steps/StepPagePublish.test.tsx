import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { routes } from "../../app/routes";
import { type MemberStep, type StepsClient } from "./api";
import type { PublishClient } from "./publishApi";
import { forgetSent } from "./sent";
import { StepPage } from "./StepPage";

const confirm: MemberStep = {
  id: "s2",
  title: "Confirm arrival",
  formName: "Arrival",
  roleName: "Director",
  workflowName: "Case referral",
  opensIn: "form",
  agencyName: "",
  state: "waiting",
  orderId: "o7",
  recordCode: "REC-1",
  earlier: [],
  questions: [{ prompt: "Arrived", answerType: "yes_no", helper: "", required: true }],
};

const clientOf = (found: MemberStep[]): StepsClient => ({ available: async () => found, submit: vi.fn(async () => ({ done: true, next: null, orderId: "o7" })) });

const publisherOf = (holds: boolean): PublishClient => ({
  holds: async () => holds,
  closedFormId: async () => "f1",
  latest: async () => null,
  files: async () => [{ name: "r.pdf", path: "r.pdf", version: "abc1234def5678", committedAt: "2026-11-13T10:00:00Z" }],
  publish: vi.fn(async () => ({ version: 1, gitPath: "r.pdf", publishedAt: "2026-11-13T10:00:00Z" })),
});

const show = async (publisher: PublishClient) => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[routes.step.path({ stepId: "s2" }, { order: "o7" })]}>
        <Routes>
          <Route path={routes.step.pattern} element={<StepPage steps={clientOf([confirm])} publisher={publisher} />} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

beforeEach(() => openAgency("farmers"));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  forgetOpenAgency();
  forgetSent();
});

describe("the step page offers publishing to the holder of the report permission", () => {
  it("shows a Publish button when the member holds the permission", async () => {
    await show(publisherOf(true));
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("shows no Publish button without the permission and keeps Send", async () => {
    await show(publisherOf(false));
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });
});

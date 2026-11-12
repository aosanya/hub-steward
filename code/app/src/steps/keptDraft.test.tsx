import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { routes } from "../routes";
import { StepRefused, type MemberStep, type StepsClient } from "./api";
import { forgetSent } from "./sent";
import { StepPage } from "./StepPage";

const referral: MemberStep = {
  id: "s1",
  title: "Refer the case",
  formName: "Referral",
  roleName: "Volunteer",
  workflowName: "Case referral",
  opensIn: "form",
  agencyName: "",
  state: "start",
  orderId: "",
  recordCode: "REC-1",
  questions: [
    { prompt: "Reason", answerType: "free_text", helper: "", required: true },
    { prompt: "Needs transport", answerType: "yes_no", helper: "", required: true },
  ],
};

const confirm: MemberStep = { ...referral, id: "s2", formName: "Confirm arrival", state: "waiting", orderId: "o7", questions: [{ prompt: "Reason", answerType: "free_text", helper: "", required: true }] };

const sentOk = vi.fn(async () => ({ done: true, next: null, orderId: "o1" }));

const clientOf = (found: MemberStep[], submit: StepsClient["submit"] = sentOk): StepsClient => ({ available: async () => found, submit });

const open = async (client: StepsClient, at = "s1", order = "") =>
  act(async () => {
    render(
      <MemoryRouter initialEntries={[routes.step.path({ stepId: at }, order ? { order } : undefined)]}>
        <Routes>
          <Route path={routes.step.pattern} element={<StepPage steps={client} />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });

const reopen = async (client: StepsClient, at = "s1", order = "") => {
  cleanup();
  await open(client, at, order);
};

beforeEach(() => {
  window.localStorage.clear();
  openAgency("farmers");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  forgetOpenAgency();
  forgetSent();
  window.localStorage.clear();
});

describe("a half-filled step form is kept on the phone until the server confirms the send", () => {
  it("brings the typed answers back when the form is reopened after Back or a killed app", async () => {
    const client = clientOf([referral]);
    await open(client);
    await userEvent.type(screen.getByLabelText("Reason"), "Needs a clinic");
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await reopen(client);
    expect(screen.getByLabelText("Reason")).toHaveValue("Needs a clinic");
    expect(screen.getByRole("radio", { name: "Yes" })).toBeChecked();
  });

  it("keeps the answers when the send is refused, so the next opening still has them", async () => {
    const submit = vi.fn().mockRejectedValue(new StepRefused("invalid"));
    const client = clientOf([referral], submit);
    await open(client);
    await userEvent.type(screen.getByLabelText("Reason"), "Needs a clinic");
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Check your answers and try again.");
    await reopen(client);
    expect(screen.getByLabelText("Reason")).toHaveValue("Needs a clinic");
  });

  it("clears the answers when the server confirms the send", async () => {
    const client = clientOf([referral]);
    await open(client);
    await userEvent.type(screen.getByLabelText("Reason"), "Needs a clinic");
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("elsewhere");
    await reopen(client);
    expect(screen.getByLabelText("Reason")).toHaveValue("");
  });

  it("keys the answers by agency, step and run, so another run of the same step starts empty", async () => {
    const client = clientOf([confirm, { ...confirm, orderId: "o8" }]);
    await open(client, "s2", "o7");
    await userEvent.type(screen.getByLabelText("Reason"), "First run");
    await reopen(client, "s2", "o8");
    expect(screen.getByLabelText("Reason")).toHaveValue("");
    await reopen(client, "s2", "o7");
    expect(screen.getByLabelText("Reason")).toHaveValue("First run");
  });

  it("keeps another agency's answers apart", async () => {
    const client = clientOf([referral]);
    await open(client);
    await userEvent.type(screen.getByLabelText("Reason"), "Farmers answer");
    openAgency("clinic");
    await reopen(client);
    expect(screen.getByLabelText("Reason")).toHaveValue("");
    openAgency("farmers");
    await reopen(client);
    expect(screen.getByLabelText("Reason")).toHaveValue("Farmers answer");
  });

  it("starts empty and still works when the phone refuses to store anything", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await open(clientOf([referral]));
    await userEvent.type(screen.getByLabelText("Reason"), "Typed");
    expect(screen.getByLabelText("Reason")).toHaveValue("Typed");
  });
});

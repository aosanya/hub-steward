import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { routes } from "../routes";
import * as mcp from "../wakala/mcp";
import { mcpStepsClient, refusalWords, StepRefused, type MemberStep, type StepsClient } from "./api";
import { forgetSent, wasSent } from "./sent";
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
    { prompt: "Visits this week", answerType: "number", helper: "", required: true },
    { prompt: "Needs transport", answerType: "yes_no", helper: "", required: true },
    { prompt: "Visit date", answerType: "date", helper: "", required: true },
    { prompt: "How soon", answerType: "single_choice", helper: "", required: true, options: ["Same day", "This week"] },
    { prompt: "Note", answerType: "free_text", helper: "" },
  ],
};

const confirm: MemberStep = { ...referral, id: "s2", formName: "Confirm arrival", state: "waiting", orderId: "o7", questions: [{ prompt: "Arrived", answerType: "yes_no", helper: "", required: true }] };

let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return <p>elsewhere</p>;
};

const clientOf = (found: MemberStep[], submit: StepsClient["submit"] = vi.fn(async () => ({ done: true, next: null, orderId: "o1" }))): StepsClient => ({ available: async () => found, submit });

const show = async (client: StepsClient, at = "s1", order = "") => {
  landed = "";
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[routes.step.path({ stepId: at }, order ? { order } : undefined)]}>
        <Routes>
          <Route path={routes.step.pattern} element={<StepPage steps={client} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

const fillAll = async () => {
  await userEvent.type(screen.getByLabelText("Reason"), "Needs a clinic check");
  await userEvent.type(screen.getByLabelText("Visits this week"), "3");
  await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
  fireEvent.change(screen.getByLabelText("Visit date"), { target: { value: "2026-11-06" } });
  await userEvent.click(screen.getByRole("radio", { name: "Same day" }));
};

beforeEach(() => openAgency("farmers"));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  forgetOpenAgency();
  forgetSent();
});

describe("a member fills in one of her own steps", () => {
  it("shows the step's form with one input for each question, by its answer type", async () => {
    await show(clientOf([referral]));
    expect(screen.getAllByText("Referral").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Reason")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Visits this week")).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("Visit date")).toHaveAttribute("type", "date");
    expect(screen.getByRole("radio", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "No" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Same day" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "This week" })).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toBeInTheDocument();
  });

  it("does not send while a required question is unanswered, and says which", async () => {
    const client = clientOf([referral]);
    await show(client);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getAllByText("This question needs an answer")).toHaveLength(5);
    expect(client.submit).not.toHaveBeenCalled();
  });

  it("asks for a number where a number is expected", async () => {
    const client = clientOf([referral]);
    await show(client);
    await fillAll();
    fireEvent.change(screen.getByLabelText("Visits this week"), { target: { value: "" } });
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(client.submit).not.toHaveBeenCalled();
    expect(screen.getAllByText("This question needs an answer")).toHaveLength(1);
  });

  it("sends the answers keyed by prompt as strings, leaves out the optional question left empty, marks the step Sent and goes back to Do Something", async () => {
    const client = clientOf([referral]);
    await show(client);
    await fillAll();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(client.submit).toHaveBeenCalledWith(referral, {
      Reason: "Needs a clinic check",
      "Visits this week": "3",
      "Needs transport": "yes",
      "Visit date": "2026-11-06",
      "How soon": "Same day",
    }, expect.any(String));
    expect(wasSent({ id: "s1", orderId: "o1" })).toBe(true);
    expect(screen.getByText("elsewhere")).toBeInTheDocument();
    expect(landed).toBe("/a/farmers/do-something");
  });

  it("sends a waiting step with its run, which the list gave", async () => {
    const client = clientOf([confirm]);
    await show(client, "s2", "o7");
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(client.submit).toHaveBeenCalledWith(expect.objectContaining({ id: "s2", state: "waiting", orderId: "o7" }), { Arrived: "yes" }, expect.any(String));
  });

  it.each([
    [new StepRefused("role"), "This step is not for your role."],
    [new StepRefused("not-ready"), "This step is not ready or was already sent."],
    [new StepRefused("invalid"), "Check your answers and try again."],
    [new Error("down"), refusalWords.failed],
  ])("keeps the form and says why in plain words when the send is refused (%s)", async (failure, words) => {
    const submit = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce({ done: true, next: null, orderId: "o1" });
    await show(clientOf([referral], submit));
    await fillAll();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText(words)).toBeInTheDocument();
    expect(wasSent({ id: "s1", orderId: "o1" })).toBe(false);
    expect(screen.getByLabelText("Reason")).toHaveValue("Needs a clinic check");
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(wasSent({ id: "s1", orderId: "o1" })).toBe(true);
  });

  it("cannot be sent twice while the first send is still on its way", async () => {
    const submit = vi.fn(() => new Promise<never>(() => undefined));
    await show(clientOf([referral], submit));
    await fillAll();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("button", { name: "Sending" })).toBeDisabled();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("tells a member a photo or file question cannot be sent from here and does not let a required one through", async () => {
    const withPhoto: MemberStep = { ...referral, questions: [{ prompt: "Photo", answerType: "photo", helper: "", required: true }] };
    const client = clientOf([withPhoto]);
    await show(client);
    expect(screen.getByText(/Photo: a photo or file cannot be sent from here yet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByText(/needs a photo or file/)).toBeInTheDocument();
    expect(client.submit).not.toHaveBeenCalled();
  });

  it("does not open a waiting step under another run's number", async () => {
    await show(clientOf([confirm]), "s2", "o8");
    expect(await screen.findByText("This task has closed.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("says it has closed for a step that is not in her list, which is how another role's step looks to her", async () => {
    await show(clientOf([referral]), "someone-elses");
    expect(await screen.findByText("This task has closed.")).toBeInTheDocument();
    expect(screen.queryByText("This task could not be opened.")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Reason")).not.toBeInTheDocument();
  });

  it("says it could not be opened, never that it closed, when her steps cannot be read, and Try again reads them again", async () => {
    const available = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue([referral]);
    await show({ available, submit: vi.fn() });
    expect(await screen.findByRole("alert")).toHaveTextContent("This task could not be opened.");
    expect(screen.queryByText("This task has closed.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Reason")).toBeInTheDocument();
    expect(available).toHaveBeenCalledTimes(2);
  });
});

describe("a member whose next step is a send_form step", () => {
  const sendRaw = {
    id: "send1",
    title: "Send the paper return",
    kind: "send_form",
    workflow_id: "w9",
    workflow_name: "Paper return",
    role_id: "r18",
    role_name: "Recipient",
    form_name: "Paper return",
    record_code: "REC-9",
    state: "waiting",
    order_id: "o9",
    questions: [{ prompt: "Channel", answer_type: "single_choice", required: true, options: ["Papíron", "Telefonon"] }],
  };

  it("opens it by its address and sends its answers to the step with its run", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [sendRaw] });
    const posted = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ done: false, order_id: "o9" }), { status: 201 }));
    await show(mcpStepsClient, "send1", "o9");
    expect(screen.queryByText("This task could not be opened.")).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("radio", { name: "Papíron" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    const [url, init] = posted.mock.calls[0];
    expect(String(url)).toContain("/steps/send1/answers");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ answers: { Channel: "Papíron" }, order_id: "o9" });
    expect(landed).toBe("/a/farmers/do-something");
  });
});

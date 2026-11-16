import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import * as mcp from "../../shared/wakala/mcp";
import { mcpStepsClient, memberStepOf } from "./api";
import { forgetSent } from "./sent";

const raw = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  title: "Refer the case",
  kind: "fill_form",
  workflow_id: "w1",
  workflow_name: "Case referral",
  role_id: "r1",
  role_name: "Volunteer",
  form_name: "Referral",
  record_code: "REC-1",
  state: "start",
  questions: [{ prompt: "Reason", answer_type: "free_text", required: true }],
  ...over,
});

const earlier = [
  {
    step_title: "Report a referral",
    role_name: "Volunteer",
    answers: [
      { prompt: "Reason", answer: "Needs a clinic check" },
      { prompt: "Minutes to the clinic", answer: "25" },
    ],
  },
];

const fetched = (status: number, body: unknown = {}) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

const anyStep = (step: unknown) => step as Record<string, unknown>;

beforeEach(() => openAgency("hub1"));

afterEach(() => {
  vi.restoreAllMocks();
  forgetSent();
  forgetOpenAgency();
});

describe("reading the prompt and the earlier answers", () => {
  it("reads the work item's prompt from a listed step", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [raw({ prompt: "Ask the family why they were sent." })] });
    const [step] = await mcpStepsClient.available();
    expect(anyStep(step).prompt).toBe("Ask the family why they were sent.");
  });

  it("reads a waiting step's earlier steps with their role and answers, in the order given", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [raw({ state: "waiting", order_id: "o9", prompt: "Call the clinic.", earlier })] });
    const [step] = await mcpStepsClient.available();
    expect(anyStep(step).earlier).toEqual([
      {
        stepTitle: "Report a referral",
        roleName: "Volunteer",
        answers: [
          { prompt: "Reason", answer: "Needs a clinic check" },
          { prompt: "Minutes to the clinic", answer: "25" },
        ],
      },
    ]);
  });

  it("reads no prompt and no earlier steps when the reply has none", () => {
    const step = anyStep(memberStepOf(raw()));
    expect(step.prompt ?? "").toBe("");
    expect(step.earlier ?? []).toEqual([]);
  });

  it("reads the prompt of the next step a send returns", async () => {
    fetched(201, { done: true, order_id: "o1", next_step: raw({ id: "s2", state: "waiting", order_id: "o1", prompt: "Call the clinic.", earlier }) });
    const sent = await mcpStepsClient.submit({ id: "s1", state: "start", orderId: "" }, { Reason: "Needs a clinic check" }, "k1");
    expect(anyStep(sent.next).prompt).toBe("Call the clinic.");
  });
});

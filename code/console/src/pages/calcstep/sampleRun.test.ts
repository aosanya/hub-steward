import { describe, expect, it, vi } from "vitest";
import { runSample, type Problem, type SampleAnswer, type SampleClient } from "./sampleRun";

const inputs = ["principal", "monthly_rate", "months"];

const worked: SampleAnswer = {
  worked: { label: "Monthly payment", value: "564.88", function: "fin.pmt@2", rounding: "half up" },
};

const problem = (over: Partial<Problem>): Problem => ({
  input: null,
  item: null,
  given: null,
  value: null,
  rule: "type",
  sentence: "",
  code: "wrong-type",
  check: null,
  ...over,
});

const threeProblems: SampleAnswer = {
  problems: [
    problem({ input: "principal", given: false, rule: "required", code: "required", sentence: "`principal` was not given. It is required." }),
    problem({ input: "monthly_rate", given: true, value: "twelve", sentence: "`monthly_rate` is twelve. It must be a number." }),
    problem({ input: "months", given: true, value: "-24", rule: "no-negatives", code: "no-negatives", sentence: "`months` is -24. It may not be negative." }),
  ],
};

const clientAnswering = (answer: SampleAnswer): SampleClient & { run: ReturnType<typeof vi.fn> } => ({
  run: vi.fn().mockResolvedValue(answer),
});

describe("running a sample", () => {
  it("sends the typed text of each input in the order the function lists them", async () => {
    const client = clientAnswering(worked);
    await runSample(client, inputs, { months: "24", principal: "12,000.00", monthly_rate: "0.01" });
    expect(client.run).toHaveBeenCalledTimes(1);
    expect(client.run).toHaveBeenCalledWith([
      { name: "principal", text: "12,000.00" },
      { name: "monthly_rate", text: "0.01" },
      { name: "months", text: "24" },
    ]);
  });

  it("sends an input nobody typed in as empty text", async () => {
    const client = clientAnswering(worked);
    await runSample(client, inputs, { principal: "12,000.00" });
    expect(client.run).toHaveBeenCalledWith([
      { name: "principal", text: "12,000.00" },
      { name: "monthly_rate", text: "" },
      { name: "months", text: "" },
    ]);
  });

  it("gives the result with the function and the rounding rule used", async () => {
    const outcome = await runSample(clientAnswering(worked), inputs, {});
    expect(outcome).toEqual({ kind: "worked", label: "Monthly payment", value: "564.88", function: "fin.pmt@2", rounding: "half up" });
  });

  it("gives every problem at once, in the order the library listed them", async () => {
    const outcome = await runSample(clientAnswering(threeProblems), inputs, {});
    expect(outcome.kind).toBe("problems");
    if (outcome.kind !== "problems") return;
    expect(outcome.rows.map((row) => row.input)).toEqual(["principal", "monthly_rate", "months"]);
  });

  it("keeps the order the library gave even when it is not the order of the inputs", async () => {
    const reversed: SampleAnswer = { problems: [...threeProblems.problems!].reverse() };
    const outcome = await runSample(clientAnswering(reversed), inputs, {});
    if (outcome.kind !== "problems") throw new Error("expected problems");
    expect(outcome.rows.map((row) => row.input)).toEqual(["months", "monthly_rate", "principal"]);
  });

  it("names the input, the value received and the sentence of each problem, and writes none of its own", async () => {
    const outcome = await runSample(clientAnswering(threeProblems), inputs, {});
    if (outcome.kind !== "problems") throw new Error("expected problems");
    expect(outcome.rows).toEqual([
      { input: "principal", received: null, sentence: "`principal` was not given. It is required.", code: "required" },
      { input: "monthly_rate", received: "twelve", sentence: "`monthly_rate` is twelve. It must be a number.", code: "wrong-type" },
      { input: "months", received: "-24", sentence: "`months` is -24. It may not be negative.", code: "no-negatives" },
    ]);
  });

  it("names a problem of a check by the check's text", async () => {
    const answer: SampleAnswer = {
      problems: [problem({ rule: "check", code: "check-failed", check: "payment <= balance", sentence: "The check `payment <= balance` was not true." })],
    };
    const outcome = await runSample(clientAnswering(answer), inputs, {});
    if (outcome.kind !== "problems") throw new Error("expected problems");
    expect(outcome.rows[0]).toEqual({ input: "payment <= balance", received: "", sentence: "The check `payment <= balance` was not true.", code: "check-failed" });
  });

  it("says the sample failed when the call fails, and does not throw", async () => {
    const client: SampleClient = { run: vi.fn().mockRejectedValue(new Error("offline")) };
    await expect(runSample(client, inputs, {})).resolves.toEqual({ kind: "failed" });
  });

  it("posts and saves nothing: the client only runs, and nothing is kept in the browser", async () => {
    const client = clientAnswering(worked);
    localStorage.clear();
    sessionStorage.clear();
    await runSample(client, inputs, { principal: "12,000.00" });
    expect(Object.keys(client)).toEqual(["run"]);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

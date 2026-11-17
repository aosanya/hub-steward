export type Problem = {
  input: string | null;
  item: number | null;
  given: boolean | null;
  value: string | null;
  rule: string;
  sentence: string;
  code: string;
  check: string | null;
};

export type Worked = { label: string; value: string; function: string; rounding: string };

export type SampleAnswer = { worked?: Worked; problems?: Problem[] };

export type SampleInput = { name: string; text: string };

export type SampleClient = { run: (values: SampleInput[]) => Promise<SampleAnswer> };

export type ProblemRow = { input: string; received: string | null; sentence: string; code: string };

export type SampleOutcome = ({ kind: "worked" } & Worked) | { kind: "problems"; rows: ProblemRow[] } | { kind: "failed" };

const receivedOf = (problem: Problem) => problem.value ?? (problem.given === false ? null : "");

const rowOf = (problem: Problem): ProblemRow => ({
  input: problem.input ?? problem.check ?? "",
  received: receivedOf(problem),
  sentence: problem.sentence,
  code: problem.code,
});

export async function runSample(client: SampleClient, inputs: string[], typed: Record<string, string>): Promise<SampleOutcome> {
  const values = inputs.map((name) => ({ name, text: typed[name] ?? "" }));
  try {
    const answer = await client.run(values);
    if (answer.problems && answer.problems.length > 0) return { kind: "problems", rows: answer.problems.map(rowOf) };
    if (answer.worked) return { kind: "worked", ...answer.worked };
    return { kind: "failed" };
  } catch {
    return { kind: "failed" };
  }
}

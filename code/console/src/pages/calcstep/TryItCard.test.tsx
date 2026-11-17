import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import words from "../../../public/i18n.json";
import { I18nProvider } from "../../i18n";
import type { Problem, SampleAnswer, SampleClient } from "./sampleRun";
import { TryItCard } from "./TryItCard";

const inputs = ["principal", "monthly_rate", "months"];
const sample = { principal: "12,000.00", monthly_rate: "0.01", months: "24" };

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

const secondScreen: SampleAnswer = {
  problems: [
    problem({ input: "principal", given: false, rule: "required", code: "required", sentence: "principal is missing. Give the amount of the loan." }),
    problem({ input: "monthly_rate", given: true, value: "twelve", sentence: "monthly_rate must be a number. It was given as text." }),
    problem({ input: "months", given: true, value: "-24", rule: "no-negatives", code: "no-negatives", sentence: "months must be 1 or more. It was given as -24." }),
  ],
};

const clientAnswering = (answer: SampleAnswer | Error) => ({
  run: vi.fn(() => (answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer))),
});

const draw = (client: SampleClient, initial: Record<string, string> = sample) =>
  render(
    <I18nProvider initial={words}>
      <TryItCard inputs={inputs} initial={initial} client={client} />
    </I18nProvider>,
  );

const press = () => userEvent.click(screen.getByRole("button", { name: "Run on this sample" }));

describe("the Try it card", () => {
  it("is titled Try it and shows one box for each input, in the order the function lists them", () => {
    draw(clientAnswering(worked));
    expect(screen.getByRole("heading", { name: "Try it" })).toBeInTheDocument();
    const boxes = screen.getAllByRole("textbox");
    expect(boxes.map((box) => (box as HTMLInputElement).value)).toEqual(["12,000.00", "0.01", "24"]);
    expect(screen.getByText("principal", { selector: ".field-label" })).toBeInTheDocument();
    expect(screen.getByText("months", { selector: ".field-label" })).toBeInTheDocument();
  });

  it("shows nothing worked out before the button is pressed, and runs nothing", () => {
    const client = clientAnswering(worked);
    draw(client);
    expect(client.run).not.toHaveBeenCalled();
    expect(screen.queryByText("564.88")).not.toBeInTheDocument();
    expect(screen.queryByText("Worked out")).not.toBeInTheDocument();
  });

  it("runs the typed values when Run on this sample is pressed", async () => {
    const client = clientAnswering(worked);
    draw(client);
    await userEvent.clear(screen.getByRole("textbox", { name: "months" }));
    await userEvent.type(screen.getByRole("textbox", { name: "months" }), "36");
    await press();
    expect(client.run).toHaveBeenCalledWith([
      { name: "principal", text: "12,000.00" },
      { name: "monthly_rate", text: "0.01" },
      { name: "months", text: "36" },
    ]);
  });

  it("shows the result with the function and the rounding rule used", async () => {
    draw(clientAnswering(worked));
    await press();
    expect(await screen.findByText("564.88")).toBeInTheDocument();
    expect(screen.getByText("Monthly payment")).toBeInTheDocument();
    expect(screen.getByText("fin.pmt@2, rounded half up")).toBeInTheDocument();
    expect(screen.getByText("Worked out", { selector: ".tag" })).toBeInTheDocument();
  });

  it("shows one list with every problem, naming the input, the value received and the sentence, in the order given", async () => {
    draw(clientAnswering(secondScreen));
    await press();
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent))).toEqual([
      ["principal", "nothing", "principal is missing. Give the amount of the loan."],
      ["monthly_rate", "twelve", "monthly_rate must be a number. It was given as text."],
      ["months", "-24", "months must be 1 or more. It was given as -24."],
    ]);
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Input", "Received", "Problem"]);
  });

  it("counts the problems on the card's tag and in the tile, and says they all come back at once", async () => {
    draw(clientAnswering(secondScreen));
    await press();
    await screen.findByRole("table");
    expect(screen.getByText("3 problems", { selector: ".tag" })).toBeInTheDocument();
    expect(screen.getByText("Nothing was worked out")).toBeInTheDocument();
    expect(screen.getByText("Every problem comes back at once, in the order the function lists its inputs.")).toBeInTheDocument();
    expect(screen.queryByText("564.88")).not.toBeInTheDocument();
  });

  it("says 1 problem for one problem", async () => {
    const one: SampleAnswer = { problems: [secondScreen.problems![1]] };
    draw(clientAnswering(one));
    await press();
    await screen.findByRole("table");
    expect(screen.getByText("1 problem", { selector: ".tag" })).toBeInTheDocument();
  });

  it("replaces the problem list with the result when the next run works", async () => {
    const client = { run: vi.fn().mockResolvedValueOnce(secondScreen).mockResolvedValueOnce(worked) };
    draw(client);
    await press();
    await screen.findByRole("table");
    await press();
    expect(await screen.findByText("564.88")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("tells the builder the sample could not be run when the call fails", async () => {
    draw(clientAnswering(new Error("offline")));
    await press();
    expect(await screen.findByRole("alert")).toHaveTextContent("The sample could not be run.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps the button off while a run is under way", async () => {
    let finish: (answer: SampleAnswer) => void = () => {};
    const client = { run: vi.fn(() => new Promise<SampleAnswer>((resolve) => (finish = resolve))) };
    draw(client);
    await press();
    expect(screen.getByRole("button", { name: "Run on this sample" })).toBeDisabled();
    finish(worked);
    await waitFor(() => expect(screen.getByRole("button", { name: "Run on this sample" })).toBeEnabled());
  });

  it("keeps what was typed on the screen only: nothing is saved", async () => {
    localStorage.clear();
    draw(clientAnswering(worked));
    await userEvent.type(screen.getByRole("textbox", { name: "months" }), "0");
    await press();
    await screen.findByText("564.88");
    expect(localStorage.length).toBe(0);
  });
});

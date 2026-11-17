import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import words from "../../../public/i18n.json";
import { I18nProvider } from "../../i18n";
import { InputsCard } from "./InputsCard";
import type { InputRow } from "./sourceFlags";

const rowsWithProblems: InputRow[] = [
  {
    name: "principal",
    type: "currency",
    source: { kind: "step", step: "Apply for a loan", question: "Reason for the loan", type: "text" },
  },
  { name: "monthly_rate", type: "number", source: null },
  {
    name: "months",
    type: "number",
    source: { kind: "record", record: "Loan terms", question: "Months", type: "number", questionNow: "How many months?" },
  },
];

const rowsThatFit: InputRow[] = [
  { name: "principal", type: "currency", source: { kind: "step", step: "Apply for a loan", question: "Amount requested", type: "currency" } },
  { name: "monthly_rate", type: "number", source: { kind: "fixed", value: "0.01" } },
  { name: "months", type: "number", source: { kind: "record", record: "Loan terms", question: "Months", type: "number" } },
];

const show = (rows: InputRow[], handlers: Partial<Parameters<typeof InputsCard>[0]> = {}) =>
  render(
    <MemoryRouter>
      <I18nProvider initial={words}>
        <InputsCard rows={rows} {...handlers} />
      </I18nProvider>
    </MemoryRouter>,
  );

const rowOf = (name: string) => screen.getByRole("row", { name: new RegExp(name) });

describe("the inputs card", () => {
  it("shows one row for each input with its name and type", () => {
    show(rowsWithProblems);
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(within(rowOf("principal")).getByText("Currency")).toBeInTheDocument();
    expect(within(rowOf("monthly_rate")).getByText("Number")).toBeInTheDocument();
  });

  it("flags the wrong type, the missing source and the reworded question in words", () => {
    show(rowsWithProblems);
    expect(within(rowOf("principal")).getByText("Wrong type")).toBeInTheDocument();
    expect(within(rowOf("principal")).getByText("Apply for a loan › Reason for the loan (a text)")).toBeInTheDocument();
    expect(within(rowOf("monthly_rate")).getByText("No source")).toBeInTheDocument();
    expect(within(rowOf("monthly_rate")).getByText("No source chosen. Every input needs one.")).toBeInTheDocument();
    expect(within(rowOf("months")).getByText("Question reworded")).toBeInTheDocument();
    expect(within(rowOf("months")).getByText("Loan terms › “Months” is now worded “How many months?”. Choose the question again.")).toBeInTheDocument();
  });

  it("says that an input fits when its source fits", () => {
    show(rowsThatFit);
    expect(within(rowOf("principal")).getByText("Currency fits")).toBeInTheDocument();
    expect(within(rowOf("monthly_rate")).getByText("Number fits")).toBeInTheDocument();
    expect(within(rowOf("months")).getByText("Loan terms › Months (a number)")).toBeInTheDocument();
  });

  it("opens the four sources on the input that has none", () => {
    show(rowsWithProblems);
    const open = within(rowOf("monthly_rate")).getByRole("group", { name: "Sources for monthly_rate" });
    expect(within(open).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Answer from an earlier step",
      "Field of a record",
      "The member's ledger balance",
      "Fixed value",
    ]);
    expect(within(rowOf("principal")).queryByRole("group")).toBeNull();
  });

  it("tells the page which source was chosen for which input", async () => {
    const onChoose = vi.fn();
    show(rowsWithProblems, { onChoose });
    await userEvent.click(within(rowOf("monthly_rate")).getByRole("button", { name: "Fixed value" }));
    expect(onChoose).toHaveBeenCalledWith("monthly_rate", "fixed");
    await userEvent.selectOptions(within(rowOf("principal")).getByLabelText("Where principal comes from"), "ledger");
    expect(onChoose).toHaveBeenCalledWith("principal", "ledger");
  });

  it("lets a fixed value be typed in", async () => {
    const onFixedValue = vi.fn();
    show(rowsThatFit, { onFixedValue });
    await userEvent.type(within(rowOf("monthly_rate")).getByLabelText("Value for monthly_rate"), "5");
    expect(onFixedValue).toHaveBeenCalledWith("monthly_rate", "0.015");
  });

  it("says so when the function has no inputs", () => {
    show([]);
    expect(screen.getByText("This function has no inputs.")).toBeInTheDocument();
  });
});

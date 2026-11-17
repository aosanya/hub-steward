import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import words from "../../public/i18n.json";
import { I18nProvider } from "../i18n";
import { InputsCard } from "../pages/calcstep/InputsCard";
import type { InputRow } from "../pages/calcstep/sourceFlags";
import { savePage } from "./walkShot";

const rows: InputRow[] = [
  { name: "principal", type: "currency", source: { kind: "step", step: "Apply for a loan", question: "Reason for the loan", type: "text" } },
  { name: "monthly_rate", type: "number", source: null },
  {
    name: "months",
    type: "number",
    source: { kind: "record", record: "Loan terms", question: "Months", type: "number", questionNow: "How many months?" },
  },
];

describe("a builder sets up the inputs of a calculating step", () => {
  it("is told in words which inputs do not fit, have no source or point at a reworded question", () => {
    const { container } = render(
      <MemoryRouter>
        <I18nProvider initial={words}>
          <InputsCard rows={rows} />
        </I18nProvider>
      </MemoryRouter>,
    );
    const rowOf = (name: string) => screen.getByRole("row", { name: new RegExp(name) });
    expect(within(rowOf("principal")).getByText("Wrong type")).toBeInTheDocument();
    expect(within(rowOf("monthly_rate")).getByText("No source")).toBeInTheDocument();
    expect(within(rowOf("months")).getByText("Question reworded")).toBeInTheDocument();
    expect(within(rowOf("monthly_rate")).getByRole("group", { name: "Sources for monthly_rate" })).toBeInTheDocument();
    if (process.env.WALK_SHOTS) savePage(container, process.env.WALK_SHOTS, "inputs-card.html");
  });
});

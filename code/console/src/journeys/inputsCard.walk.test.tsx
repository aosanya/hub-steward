import { render, screen, within } from "@testing-library/react";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { MemoryRouter } from "react-router-dom";
import words from "../../public/i18n.json";
import { I18nProvider } from "../i18n";
import { InputsCard } from "../pages/calcstep/InputsCard";
import type { InputRow } from "../pages/calcstep/sourceFlags";

const rows: InputRow[] = [
  { name: "principal", type: "currency", source: { kind: "step", step: "Apply for a loan", question: "Reason for the loan", type: "text" } },
  { name: "monthly_rate", type: "number", source: null },
  {
    name: "months",
    type: "number",
    source: { kind: "record", record: "Loan terms", question: "Months", type: "number", questionNow: "How many months?" },
  },
];

const styles = ["design.css", "ui/ui.css", "ui/notice.css", "ui/draftBar.css"].map((file) => readFileSync(resolve(__dirname, "..", file), "utf8")).join("\n");

const keepChoices = (root: HTMLElement) => {
  root.querySelectorAll("select").forEach((select) => {
    Array.from(select.options).forEach((option) => (option.selected ? option.setAttribute("selected", "") : option.removeAttribute("selected")));
  });
  root.querySelectorAll("input").forEach((input) => input.setAttribute("value", input.value));
};

const savePage = (root: HTMLElement, folder: string, name: string) => {
  keepChoices(root);
  mkdirSync(folder, { recursive: true });
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${styles}</style></head><body><div data-theme="dark" style="padding:1.5rem;min-height:100vh;box-sizing:border-box;background:var(--bg)"><div style="max-width:60rem">${root.innerHTML}</div></div></body></html>`;
  writeFileSync(join(folder, name), page);
};

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

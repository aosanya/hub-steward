import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { useState } from "react";
import words from "../../public/i18n.json";
import { I18nProvider } from "../i18n";
import { StepCard, type StepCardValue } from "../pages/calcstep/StepCard";

const steps = [
  { id: "apply", name: "Apply for a loan" },
  { id: "work-out", name: "Work out the monthly payment" },
  { id: "review", name: "Loan officer reviews" },
  { id: "post", name: "Post the payment" },
];

const roles = [
  { id: "officer", name: "Loan officer" },
  { id: "treasurer", name: "Group treasurer" },
];

const opening: StepCardValue = { runner: { kind: "agency" }, failure: null, resultName: "Monthly payment", rounding: null };

const styles = ["design.css", "ui/ui.css", "ui/segmented.css"].map((file) => readFileSync(resolve(__dirname, "..", file), "utf8")).join("\n");

const keepChoices = (root: HTMLElement) => {
  root.querySelectorAll("select").forEach((select) => {
    Array.from(select.options).forEach((option) => (option.selected ? option.setAttribute("selected", "") : option.removeAttribute("selected")));
  });
  root.querySelectorAll("input").forEach((input) => input.setAttribute("value", input.value));
};

const savePage = (root: HTMLElement, folder: string, name: string) => {
  keepChoices(root);
  mkdirSync(folder, { recursive: true });
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${styles}</style></head><body><div data-theme="dark" style="padding:1.5rem;min-height:100vh;box-sizing:border-box;background:var(--bg)"><div style="max-width:44rem">${root.innerHTML}</div></div></body></html>`;
  writeFileSync(join(folder, name), page);
};

function Builder() {
  const [value, setValue] = useState<StepCardValue>(opening);
  return <StepCard stepId="work-out" steps={steps} roles={roles} value={value} onChange={setValue} />;
}

describe("a builder sets what happens when a calculating step cannot work out a result", () => {
  it("is told the choice is missing, then chooses a step to go to and the sentence goes", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <I18nProvider initial={words}>
        <Builder />
      </I18nProvider>,
    );
    const sentence = /Choose what happens when this step cannot work out a result/;
    expect(screen.getByRole("alert")).toHaveTextContent(sentence);
    if (process.env.WALK_SHOTS) savePage(container, process.env.WALK_SHOTS, "step-card-empty.html");

    await user.click(screen.getByRole("button", { name: "Go to a step" }));
    const picker = screen.getByLabelText("Step to go to");
    expect(within(picker).queryByRole("option", { name: "Work out the monthly payment" })).not.toBeInTheDocument();
    await user.selectOptions(picker, "review");
    await user.click(screen.getByRole("button", { name: "A role confirms the figure first" }));
    await user.click(screen.getByRole("button", { name: "Half even" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Confirming role")).toHaveValue("officer");
    expect(screen.getByRole("button", { name: "Half even", pressed: true })).toBeInTheDocument();
    if (process.env.WALK_SHOTS) savePage(container, process.env.WALK_SHOTS, "step-card-made.html");
  });
});

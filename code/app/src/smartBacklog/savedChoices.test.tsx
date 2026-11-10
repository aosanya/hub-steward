import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { RulesScreen } from "./RulesScreen";
import type { Draft } from "./rulesDraft";
import type { FieldChoices } from "./types";

beforeEach(() => openAgency("hub-steward-swe"));

afterEach(() => forgetOpenAgency());

const choices: FieldChoices = { tag: ["Docs", "hub-steward"], mark: ["Ready", "Blocked"], backlog: ["Software", "Documentation"], step: ["To do", "Doing"], priority: ["critical", "high"] };

const saved: Draft = {
  name: "walk ready",
  match: "all",
  rules: [
    { field: "step", operator: "is", value: "to do" },
    { field: "tag", operator: "has", value: "docs" },
    { field: "backlog", operator: "is", value: "software" },
    { field: "mark", operator: "is", value: "ready" },
    { field: "priority", operator: "is", value: "HIGH" },
  ],
};

const edit = (initial: Draft) => {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  render(
    <MemoryRouter>
      <RulesScreen choices={choices} count={vi.fn().mockResolvedValue(1)} onCreate={onCreate} onBack={() => undefined} initial={initial} title="Edit walk ready" submitLabel="Save" />
    </MemoryRouter>,
  );
  return onCreate;
};

describe("editing a saved rule set", () => {
  it("shows each saved choice as the list's own spelling, whatever case the hub stored", () => {
    edit(saved);
    expect(screen.getByLabelText("Value of rule 1")).toHaveDisplayValue("To do");
    expect(screen.getByLabelText("Value of rule 2")).toHaveDisplayValue("Docs");
    expect(screen.getByLabelText("Value of rule 3")).toHaveDisplayValue("Software");
    expect(screen.getByLabelText("Value of rule 4")).toHaveDisplayValue("Ready");
    expect(screen.getByLabelText("Value of rule 5")).toHaveDisplayValue("high");
  });

  it("saves the list's spelling without the person touching a rule", async () => {
    const onCreate = edit(saved);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onCreate).toHaveBeenCalledWith("walk ready", {
      match: "all",
      rules: [
        { field: "step", operator: "is", value: "To do" },
        { field: "tag", operator: "has", value: "Docs" },
        { field: "backlog", operator: "is", value: "Software" },
        { field: "mark", operator: "is", value: "Ready" },
        { field: "priority", operator: "is", value: "high" },
      ],
    });
  });

  it("keeps a saved step the list does not hold and shows it as it is", async () => {
    const onCreate = edit({ name: "old", match: "all", rules: [{ field: "step", operator: "is", value: "Reviewing" }] });
    expect(screen.getByLabelText("Value of rule 1")).toHaveDisplayValue("Reviewing");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onCreate).toHaveBeenCalledWith("old", { match: "all", rules: [{ field: "step", operator: "is", value: "Reviewing" }] });
  });
});

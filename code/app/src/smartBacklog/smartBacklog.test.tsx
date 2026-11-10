import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { RulesScreen } from "./RulesScreen";
import type { FieldChoices } from "./types";

beforeEach(() => openAgency("hub-steward-swe"));

afterEach(() => forgetOpenAgency());

const choices: FieldChoices = { tag: ["Docs", "hub-steward"], mark: ["Ready", "Blocked"], backlog: ["Software", "Documentation"], step: ["To do", "Doing"], priority: ["P1", "P2"] };

const show = (over: { count?: ReturnType<typeof vi.fn>; onCreate?: ReturnType<typeof vi.fn>; onBack?: () => void } = {}) => {
  const count = over.count ?? vi.fn().mockResolvedValue(3);
  const onCreate = over.onCreate ?? vi.fn().mockResolvedValue(undefined);
  render(
    <MemoryRouter>
      <RulesScreen choices={choices} count={count} onCreate={onCreate} onBack={over.onBack ?? (() => undefined)} />
    </MemoryRouter>,
  );
  return { count, onCreate };
};

const addRuleOn = async (field: string) => {
  await userEvent.click(screen.getByRole("button", { name: "+ Add a rule" }));
  const sheet = screen.getByRole("dialog", { name: "Rule on" });
  await userEvent.click(within(sheet).getByRole("button", { name: field }));
};

describe("the rules screen", () => {
  it("opens with a name, Match all, no rules, and no count", () => {
    show();
    expect(screen.getByRole("heading", { name: "Add a smart backlog" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByRole("button", { name: "all" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "any" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("lists the nine fields in the picker sheet", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "+ Add a rule" }));
    const sheet = screen.getByRole("dialog", { name: "Rule on" });
    expect(within(sheet).getAllByRole("button").map((button) => button.textContent)).toEqual(
      expect.arrayContaining(["Tag", "Mark", "Backlog", "Step", "Priority", "Title", "Description", "Waits on", "Last changed"]),
    );
  });

  it("adds a rule with its operators and values, then counts the matches live", async () => {
    const { count } = show();
    await addRuleOn("Mark");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("Operator of rule 1")).toHaveValue("is");
    expect(screen.getByLabelText("Value of rule 1")).toHaveValue("Ready");
    expect(await screen.findByRole("status")).toHaveTextContent("3 issues match now");
    expect(count).toHaveBeenLastCalledWith({ match: "all", rules: [{ field: "mark", operator: "is", value: "Ready" }] });
    await userEvent.selectOptions(screen.getByLabelText("Value of rule 1"), "Blocked");
    await waitFor(() => expect(count).toHaveBeenLastCalledWith({ match: "all", rules: [{ field: "mark", operator: "is", value: "Blocked" }] }));
  });

  it("does not count a rule that is not finished", async () => {
    const { count } = show();
    await addRuleOn("Title");
    expect(count).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Value of rule 1"), "voice");
    await waitFor(() => expect(count).toHaveBeenCalled());
  });

  it("changes a rule's field from its own picker and removes a rule", async () => {
    show();
    await addRuleOn("Mark");
    await userEvent.click(screen.getByRole("button", { name: "Field of rule 1" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Rule on" })).getByRole("button", { name: "Last changed" }));
    expect(screen.getByLabelText("Operator of rule 1")).toHaveValue("in_last");
    expect(screen.getByLabelText("Number of rule 1")).toHaveValue("30");
    expect(screen.getByLabelText("Unit of rule 1")).toHaveValue("days");
    await userEvent.click(screen.getByRole("button", { name: "Remove rule 1" }));
    expect(screen.queryByLabelText("Operator of rule 1")).toBeNull();
  });

  it("asks for what is missing and creates nothing until it is there", async () => {
    const { onCreate } = show();
    await userEvent.click(screen.getByRole("button", { name: "Create smart backlog" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Give the smart backlog a name.");
    await userEvent.type(screen.getByLabelText("Name"), "Ready to start");
    await userEvent.click(screen.getByRole("button", { name: "Create smart backlog" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one rule.");
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("creates the smart backlog with its name, match and rules", async () => {
    const { onCreate } = show();
    await userEvent.type(screen.getByLabelText("Name"), " Ready to start ");
    await userEvent.click(screen.getByRole("button", { name: "any" }));
    await addRuleOn("Mark");
    await addRuleOn("Step");
    await userEvent.click(screen.getByRole("button", { name: "Create smart backlog" }));
    expect(onCreate).toHaveBeenCalledWith("Ready to start", {
      match: "any",
      rules: [
        { field: "mark", operator: "is", value: "Ready" },
        { field: "step", operator: "is", value: "To do" },
      ],
    });
  });

  it("says why when the hub refuses and lets the person try again", async () => {
    const onCreate = vi.fn().mockRejectedValueOnce(new Error("Ready to start already has these rules.")).mockResolvedValue(undefined);
    show({ onCreate });
    await userEvent.type(screen.getByLabelText("Name"), "Next up");
    await addRuleOn("Mark");
    await userEvent.click(screen.getByRole("button", { name: "Create smart backlog" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ready to start already has these rules.");
    await userEvent.click(screen.getByRole("button", { name: "Create smart backlog" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(2));
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Scenario } from "../../data/scenario";
import { I18nProvider } from "../../i18n";
import { sendAction } from "../spec/sendAction";
import { EditScenarioForm } from "./EditScenarioForm";

vi.mock("../spec/sendAction", () => ({
  failureOf: () => "",
  sendAction: vi.fn(async () => "accepted"),
}));

vi.mock("../../data/scenario", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  loadChoices: async () => ({
    workflows: [
      {
        id: "w1",
        name: "Buy now",
        steps: [
          {
            id: "st1",
            title: "Ask",
            roleId: "role-farmer",
            prompts: ["Product", "Bags", "Supplier"],
            questions: [
              { prompt: "Product", options: [], optionsFrom: "" },
              { prompt: "Bags", options: [], optionsFrom: "" },
              { prompt: "Supplier", options: [], optionsFrom: "Supplier" },
              { prompt: "Group", options: [], optionsFrom: "Siaya farmers" },
            ],
          },
          {
            id: "st2",
            title: "Answered",
            roleId: "role-supplier",
            prompts: ["Can you fill this order?"],
            questions: [
              {
                prompt: "Can you fill this order?",
                options: [],
                optionsFrom: "",
              },
            ],
          },
        ],
      },
    ],
    roles: [
      { id: "role-farmer", name: "Farmer" },
      { id: "role-supplier", name: "Supplier" },
      { id: "role-buyer", name: "Buyer" },
    ],
    groups: [
      { id: "g1", name: "Siaya farmers", parentId: "" },
      { id: "g2", name: "Managers' room", parentId: "" },
      { id: "g3", name: "Usonga farmers", parentId: "g1" },
      { id: "g4", name: "Sigomere farmers", parentId: "g1" },
    ],
  }),
}));

const english = {
  en: {
    required: "Required",
    cancel: "Cancel",
    submitFailed: "The change could not be sent.",
    "field.name": "Name",
    "field.summary": "What it tries",
    "field.workflow_id": "Workflow",
    "test.tab.scenario": "Scenario",
    "test.tab.actors": "Actors",
    "test.tab.blocks": "Steps",
    "test.editScenario": "Edit scenario",
    "test.editHint": "Saving sends it back to Not run yet.",
    "test.save": "Save",
    "test.remove": "Remove",
    "test.addActor": "Add an actor",
    "test.duplicateActor": "Names are unique in a scenario.",
    "test.builtIn": "Built in",
    "test.colActor": "Actor",
    "test.colRole": "Role",
    "test.free": "Free",
    "test.random": "Select random",
    "test.noQuestions": "No questions",
    "test.roleHeld": "A role used here cannot be removed from the agency.",
    noRows: "Nothing here yet.",
  },
};

const scenario: Scenario = {
  id: "s1",
  name: "Buy now: the shop says yes",
  summary: "Asked once",
  workflowId: "w1",
  workflow: "Buy now",
  result: "passed",
  lastRunId: "r1",
  rules: [],
  actors: [
    {
      id: "a1",
      name: "Farmer 1",
      kind: "role",
      roleId: "role-farmer",
      roleName: "Farmer",
      builtIn: false,
    },
    {
      id: "a2",
      name: "Supplier 1",
      kind: "role",
      roleId: "role-supplier",
      roleName: "Supplier",
      builtIn: false,
    },
    {
      id: "",
      name: "Farmers' agent",
      kind: "agent",
      roleId: "",
      roleName: "",
      builtIn: true,
    },
    {
      id: "",
      name: "System",
      kind: "system",
      roleId: "",
      roleName: "",
      builtIn: true,
    },
  ],
  blocks: [
    {
      stepId: "st1",
      code: "ask",
      title: "Ask",
      kind: "form",
      action: "",
      actor: "Farmer 1",
      then: "",
      endpoint: "",
      fields: [
        { prompt: "Product", free: false, value: "Urea" },
        { prompt: "Bags", free: true, value: "" },
      ],
    },
    {
      stepId: "st2",
      code: "ans",
      title: "Answered",
      kind: "form",
      action: "",
      actor: "Supplier 1",
      then: "",
      endpoint: "",
      fields: [{ prompt: "Can you fill this order?", free: true, value: "" }],
    },
  ],
  last: null,
};

const onOutcome = vi.fn();
const onCancel = vi.fn();

const open = async (shown: Scenario = scenario) => {
  const user = userEvent.setup();
  render(
    <I18nProvider initial={english}>
      <EditScenarioForm
        hubId="h1"
        scenario={shown}
        onOutcome={onOutcome}
        onCancel={onCancel}
      />
    </I18nProvider>,
  );
  await screen.findByRole("button", { name: "Save" });
  return user;
};

const sent = () =>
  vi.mocked(sendAction).mock.calls[0][3] as Record<string, unknown>;

beforeEach(() => {
  vi.mocked(sendAction).mockClear();
  onOutcome.mockClear();
});

describe("editing a scenario", () => {
  it("offers a dropdown of the scenario's actors in the role a question picks from", async () => {
    const user = await open();

    await user.click(screen.getByRole("button", { name: "Steps" }));
    const supplier = screen.getByRole("combobox", { name: "Supplier" });
    await user.selectOptions(supplier, "Supplier 1");

    expect(
      within(supplier)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Select random", "Supplier 1"]);
    expect(supplier).toHaveValue("Supplier 1");
    expect(screen.getByRole("textbox", { name: "Bags" })).toBeInTheDocument();
  });

  it("offers every group in the dropdown of a question that picks from a group", async () => {
    const user = await open();

    await user.click(screen.getByRole("button", { name: "Steps" }));
    const group = screen.getByRole("combobox", { name: "Group" });

    expect(
      within(group)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "Select random",
      "Siaya farmers",
      "Managers' room",
      "Usonga farmers",
      "Sigomere farmers",
    ]);
  });

  describe("an actor played by a group", () => {
    const grouped: Scenario = {
      ...scenario,
      actors: [
        {
          id: "a9",
          name: "Group 1",
          kind: "role",
          roleId: "g1",
          roleName: "",
          builtIn: false,
        },
      ],
    };

    it("shows the group's name in its role and offers no group nobody plays", async () => {
      const user = await open(grouped);

      await user.click(screen.getByRole("button", { name: "Actors" }));
      const role = screen.getByRole("combobox", { name: "Role" });

      expect(role).toHaveDisplayValue("Siaya farmers");
      expect(
        within(role)
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["Farmer", "Supplier", "Buyer", "Siaya farmers"]);
    });

    it("offers the actor in the dropdown of a question that picks from that group", async () => {
      const user = await open(grouped);

      await user.click(screen.getByRole("button", { name: "Steps" }));
      const group = screen.getByRole("combobox", { name: "Group" });

      expect(
        within(group)
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["Select random", "Group 1"]);
    });
  });

  it("opens the same three tabs as Add, starting on the Scenario tab filled in", async () => {
    await open();

    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(expect.arrayContaining(["Scenario", "Actors", "Steps"]));
    expect(
      screen.getByDisplayValue("Buy now: the shop says yes"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Asked once")).toBeInTheDocument();
    expect(
      screen.getByText("Saving sends it back to Not run yet."),
    ).toBeInTheDocument();
  });

  it("keeps the workflow fixed on the Scenario tab", async () => {
    await open();

    expect(screen.getByRole("combobox", { name: /Workflow/ })).toBeDisabled();
  });

  it("fills the Actors tab with the scenario's actors and roles, and lists the built-in ones apart", async () => {
    const user = await open();

    await user.click(screen.getByRole("button", { name: "Actors" }));

    expect(screen.getByDisplayValue("Farmer 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Supplier 1")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("combobox")
        .map((box) => (box as HTMLSelectElement).value),
    ).toEqual(["role-farmer", "role-supplier"]);
    expect(screen.getByText("Farmers' agent")).toBeInTheDocument();
    expect(screen.getAllByText("Built in")).toHaveLength(2);
  });

  it("says a role the scenario uses cannot be removed from the agency", async () => {
    const user = await open();

    await user.click(screen.getByRole("button", { name: "Actors" }));

    expect(
      screen.getByText("A role used here cannot be removed from the agency."),
    ).toBeInTheDocument();
  });

  it("fills the Blocks tab with the fixed answers and leaves the free ones free", async () => {
    const user = await open();

    await user.click(screen.getByRole("button", { name: "Steps" }));

    expect(screen.getByDisplayValue("Urea")).toBeInTheDocument();
    expect(
      screen
        .getAllByPlaceholderText("Free")
        .map((box) => (box as HTMLInputElement).value),
    ).toEqual(["Urea", "", ""]);
  });

  it("refuses a second actor with the same name, whatever the case, and does not save", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Actors" }));

    const second = screen.getByDisplayValue("Supplier 1");
    await user.clear(second);
    await user.type(second, " farmer 1");

    expect(
      screen.getByText("Names are unique in a scenario."),
    ).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await user.click(save);
    expect(sendAction).not.toHaveBeenCalled();
  });

  it("refuses an actor named like a built-in one", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Actors" }));

    await user.click(screen.getByRole("button", { name: "Add an actor" }));
    await user.type(screen.getAllByRole("textbox")[2], "system");

    expect(
      screen.getByText("Names are unique in a scenario."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("sends the edited name, summary, actors and fixed answers together", async () => {
    const user = await open();
    await user.type(screen.getByDisplayValue("Asked once"), " and again");
    await user.click(screen.getByRole("button", { name: "Actors" }));
    await user.click(screen.getAllByRole("button", { name: "Remove" })[1]);
    await user.click(screen.getByRole("button", { name: "Add an actor" }));
    await user.type(screen.getAllByRole("textbox")[1], "Buyer 1");
    await user.click(screen.getByRole("button", { name: "Steps" }));
    await user.type(screen.getAllByPlaceholderText("Free")[1], "3 bags");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(sendAction).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendAction).mock.calls[0].slice(0, 3)).toEqual([
      "test",
      "edit",
      "h1",
    ]);
    expect(sent()).toMatchObject({
      scenario,
      name: "Buy now: the shop says yes",
      summary: "Asked once and again",
      actors: [
        { id: "a1", name: "Farmer 1", roleId: "role-farmer" },
        { name: "Buyer 1", roleId: "role-farmer" },
      ],
      inputs: expect.arrayContaining([
        { stepId: "st1", field: "Product", value: "Urea" },
        { stepId: "st1", field: "Bags", value: "3 bags" },
      ]),
    });
    expect(onOutcome).toHaveBeenCalledWith("accepted");
  });

  it("will not save without a name and shows the Scenario tab again", async () => {
    const user = await open();
    await user.clear(screen.getByDisplayValue("Buy now: the shop says yes"));
    await user.click(screen.getByRole("button", { name: "Actors" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(sendAction).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Required: Name");
    expect(
      screen.getByRole("combobox", { name: /Workflow/ }),
    ).toBeInTheDocument();
  });

  it("says so when the change could not be sent", async () => {
    vi.mocked(sendAction).mockResolvedValueOnce("failed");
    const user = await open();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The change could not be sent.",
    );
    expect(onOutcome).not.toHaveBeenCalled();
  });

  it("goes back without saving on Cancel", async () => {
    const user = await open();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
    expect(sendAction).not.toHaveBeenCalled();
  });
});

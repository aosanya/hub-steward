import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { QuestionDraft, RouteDraft, StepDraft } from "../../data/pages/workflowDesign";
import { I18nProvider } from "../../i18n";
import { RouteFields } from "./RouteFields";

const question = (prompt: string, answerType = "free_text"): QuestionDraft => ({ prompt, answerType, required: false, helper: "", options: [], optionsFrom: "", fixed: "" });

const step = (over: Partial<StepDraft> = {}): StepDraft => ({
  key: "r",
  id: "",
  name: "Route",
  description: "",
  kind: "route",
  roleId: "",
  recipientRoleId: "",
  sentKey: "",
  runWorkflowId: "",
  formName: "",
  questions: [],
  routes: [],
  otherwiseKey: "",
  prompt: "",
  timeLimit: "",
  cancelWorkflowId: "",
  ...over,
});

const sent = (questions: QuestionDraft[]) => step({ key: "f", kind: "fill_form", questions });

const choices = [
  { value: "a", label: "Step A" },
  { value: "b", label: "Step B" },
];

const show = (own: StepDraft, form: StepDraft | undefined) => {
  const onChange = vi.fn();
  const onNewThanks = vi.fn();
  render(
    <I18nProvider initial={{ en: {} }}>
      <RouteFields id="x" step={own} sent={form} steps={choices} onChange={onChange} onNewThanks={onNewThanks} />
    </I18nProvider>,
  );
  return { onChange, onNewThanks };
};

const pick = (label: string, value: string) => fireEvent.change(screen.getAllByLabelText(label)[0], { target: { value } });

const route = (goTo: string, value = "x", over: Partial<RouteDraft> = {}): RouteDraft => ({ match: "all", rules: [{ question: "Q", operator: "is", value }], goTo, ...over });

describe("routes after a yes or no question", () => {
  const form = sent([question("Free", "free_text"), question("Agree?", "yes_no")]);

  it("shows where yes and no go and no free-form route editor", () => {
    show(step({ routes: [route("a", "yes"), route("b", "no")] }), form);
    expect(screen.getByLabelText("workflows.ifYes")).toHaveValue("a");
    expect(screen.getByLabelText("workflows.ifNo")).toHaveValue("b");
    expect(screen.queryByText("workflows.addRoute")).toBeNull();
  });

  it("sends yes to a step as one rule on the yes-no question and keeps the no route", () => {
    const { onChange } = show(step({ routes: [route("b", "no")] }), form);
    pick("workflows.ifYes", "a");
    const next = onChange.mock.calls[0][0] as StepDraft;
    expect(next.routes).toEqual([route("b", "no"), { match: "all", rules: [{ question: "Agree?", operator: "is", value: "yes" }], goTo: "a" }]);
  });

  it("replaces an earlier yes route instead of adding a second one", () => {
    const { onChange } = show(step({ routes: [route("a", "yes")] }), form);
    pick("workflows.ifYes", "b");
    expect((onChange.mock.calls[0][0] as StepDraft).routes).toHaveLength(1);
    expect((onChange.mock.calls[0][0] as StepDraft).routes[0].goTo).toBe("b");
  });

  it("asks for a new thank-you step and applies the key it is given", () => {
    const { onChange, onNewThanks } = show(step(), form);
    pick("workflows.ifNo", "__new_thanks__");
    expect(onChange).not.toHaveBeenCalled();
    const apply = onNewThanks.mock.calls[0][0] as (key: string) => StepDraft;
    expect(apply("t9").routes).toEqual([{ match: "all", rules: [{ question: "Agree?", operator: "is", value: "no" }], goTo: "t9" }]);
  });
});

describe("routes after anything else", () => {
  it("says there are no routes yet and adds one rule on the first question of the form", () => {
    const { onChange } = show(step(), sent([question("Name"), question("Age")]));
    expect(screen.getByText("workflows.noRoutes")).toBeInTheDocument();
    fireEvent.click(screen.getByText("workflows.addRoute"));
    expect((onChange.mock.calls[0][0] as StepDraft).routes).toEqual([{ match: "all", rules: [{ question: "Name", operator: "is", value: "" }], goTo: "" }]);
  });

  it("adds a route with a blank question when no form is sent", () => {
    const { onChange } = show(step(), undefined);
    fireEvent.click(screen.getByText("workflows.addRoute"));
    expect((onChange.mock.calls[0][0] as StepDraft).routes[0].rules[0].question).toBe("");
  });

  it("edits the match, question, operator, value and destination of one route among two", () => {
    const own = step({ routes: [route("a", "1", { rules: [{ question: "Name", operator: "is", value: "1" }] }), route("b", "2")] });
    const { onChange } = show(own, sent([question("Name"), question("Age")]));
    pick("workflows.match", "any");
    expect((onChange.mock.calls[0][0] as StepDraft).routes[0].match).toBe("any");
    expect((onChange.mock.calls[0][0] as StepDraft).routes[1]).toEqual(own.routes[1]);
    pick("workflows.question", "Age");
    expect((onChange.mock.calls[1][0] as StepDraft).routes[0].rules[0].question).toBe("Age");
    pick("workflows.operator", "contains");
    expect((onChange.mock.calls[2][0] as StepDraft).routes[0].rules[0].operator).toBe("contains");
    fireEvent.change(screen.getAllByLabelText("workflows.value")[0], { target: { value: "42" } });
    expect((onChange.mock.calls[3][0] as StepDraft).routes[0].rules[0].value).toBe("42");
    pick("workflows.thenGoTo", "b");
    expect((onChange.mock.calls[4][0] as StepDraft).routes[0].goTo).toBe("b");
  });

  it("adds and removes a rule inside a route and removes a whole route", () => {
    const own = step({ routes: [route("a", "1"), route("b", "2")] });
    const { onChange } = show(own, sent([question("Name")]));
    fireEvent.click(screen.getAllByText("workflows.addRule")[1]);
    expect((onChange.mock.calls[0][0] as StepDraft).routes[1].rules).toHaveLength(2);
    expect((onChange.mock.calls[0][0] as StepDraft).routes[0].rules).toHaveLength(1);
    fireEvent.click(screen.getAllByText("workflows.removeRule")[0]);
    expect((onChange.mock.calls[1][0] as StepDraft).routes[0].rules).toEqual([]);
    fireEvent.click(screen.getAllByText("workflows.removeRoute")[0]);
    expect((onChange.mock.calls[2][0] as StepDraft).routes).toEqual([own.routes[1]]);
  });

  it("sets what happens otherwise", () => {
    const { onChange } = show(step(), undefined);
    pick("workflows.otherwise", "a");
    expect((onChange.mock.calls[0][0] as StepDraft).otherwiseKey).toBe("a");
  });
});

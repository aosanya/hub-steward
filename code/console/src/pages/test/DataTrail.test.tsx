import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RunStepLine, TestRun } from "../../data/testRun";
import { I18nProvider } from "../../i18n";
import { DataTrail } from "./DataTrail";

const words = { en: { "test.noTrail": "Nothing was recorded", "test.holds": "Holds", "test.colModule": "Module", "test.endpoint": "Endpoint", "test.colLine": "Line" } };

const run = (over: Partial<TestRun> = {}): TestRun => ({
  id: "r",
  result: "passed",
  tokens: 0,
  startedAt: "",
  finishedAt: "",
  stopReason: "",
  draftVersion: "",
  rules: [],
  scenarioId: "s",
  draftLabel: "",
  tokenBudget: 0,
  steps: [],
  trail: [],
  stored: [],
  ...over,
});

const show = (value: TestRun) =>
  render(
    <I18nProvider initial={words}>
      <DataTrail run={value} />
    </I18nProvider>,
  );

const line = (stepId: string, text: string) => ({ stepId, module: "members", endpoint: "POST /x", text, at: "" });

describe("the data trail of a run", () => {
  it("says nothing was recorded when the trail is empty", () => {
    show(run());
    expect(screen.getByText("Nothing was recorded")).toBeInTheDocument();
  });

  it("groups the lines under the step they belong to, named by the step, in order of first appearance", () => {
    show(run({ steps: [{ stepId: "s1", step: "Open the order" } as RunStepLine], trail: [line("s1", "one"), line("s2", "two"), line("s1", '{"a":1}')] }));
    const titles = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(titles).toEqual(["Open the order", "s2"]);
    const first = screen.getByText("Open the order").closest("section, div.card, div") as HTMLElement;
    expect(within(first.parentElement as HTMLElement).getAllByText("members").length).toBeGreaterThan(0);
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(document.querySelector(".json")).not.toBeNull();
  });

  it("shows what each record holds with its row count even when there is no trail", () => {
    show(run({ stored: [{ record: "member", holds: "name, phone", rows: 3 }, { record: "order", holds: "", rows: 0 }] }));
    expect(screen.getByText("Nothing was recorded")).toBeInTheDocument();
    expect(screen.getByText("Holds · member")).toBeInTheDocument();
    expect(screen.getByText("name, phone")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Holds · order")).toBeInTheDocument();
  });
});

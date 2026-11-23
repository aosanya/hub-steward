import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { renderPage } from "../spec/profileTesting";
import type { CalcStepApi } from "./calcStepApi";
import { fixtureFunctions, fixtureHeader } from "./calcStepFixture";
import { CalcStepPage } from "./CalcStepPage";
import type { StepDraft } from "./saveStep";
import { loanPaymentSetup } from "./stepSetup";
import { actionItem } from "../../ui/pageHeader.test-support";

vi.mock("../../wakala/mcp");

const emptyStepApi: CalcStepApi = {
  openStep: vi.fn(async () => fixtureHeader),
  listFunctions: vi.fn(async () => fixtureFunctions),
  chosenFunction: vi.fn(async () => null),
};

const open = (onSaveStep = vi.fn(async (_hub: string, _draft: StepDraft) => {})) => {
  renderPage(<CalcStepPage hubId="h1" stepId="work-out" api={emptyStepApi} setup={loanPaymentSetup} onSaveStep={onSaveStep} />, "calc-step");
  return onSaveStep;
};

const choose = (input: string, label: string) => fireEvent.change(screen.getByLabelText(`Where ${input} comes from`), { target: { value: label } });

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the assembled calculating step screen", () => {
  it("shows the five cards one under the other in the order of the drawing", async () => {
    open();
    await screen.findByRole("heading", { level: 1, name: fixtureHeader.title });
    const titles = ["Function", "Inputs", "This step", "Try it", "Post the payment"].map((title) => screen.getByRole("heading", { name: title }));
    titles.slice(1).forEach((heading, i) => expect(titles[i].compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
  });

  it("keeps Save step off while an input has no source or no function is chosen", async () => {
    open();
    await screen.findByRole("heading", { level: 1, name: fixtureHeader.title });
    expect(await actionItem("Save step")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Function", { selector: "select" }), { target: { value: "fin.pmt@2" } });
    expect(await actionItem("Save step")).toBeDisabled();
    expect(within(screen.getByRole("table")).getAllByText("No source").length).toBe(3);
  });

  it("turns Save step on once every input has a source and hands the whole step over", async () => {
    const onSaveStep = open();
    await screen.findByRole("heading", { level: 1, name: fixtureHeader.title });
    fireEvent.change(screen.getByLabelText("Function", { selector: "select" }), { target: { value: "fin.pmt@2" } });
    choose("principal", "ledger");
    choose("monthly_rate", "fixed");
    fireEvent.change(screen.getByLabelText("Value for monthly_rate"), { target: { value: "0.01" } });
    choose("months", "fixed");
    fireEvent.change(screen.getByLabelText("Value for months"), { target: { value: "12" } });
    expect(await actionItem("Save step")).toBeEnabled();
    fireEvent.click(await actionItem("Save step"));
    await waitFor(async () => expect(await actionItem("Save step")).toBeEnabled());
    expect(onSaveStep).toHaveBeenCalledTimes(1);
    const [hubId, draft] = onSaveStep.mock.calls[0];
    expect(hubId).toBe("h1");
    expect(draft.function).toBe("fin.pmt@2");
    expect(draft.stepId).toBe("work-out");
    expect(draft.inputs.map((row) => row.source?.kind)).toEqual(["ledger", "fixed", "fixed"]);
  });
});

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../wakala/mcp";
import type { CalcStepApi } from "../pages/calcstep/calcStepApi";
import { fixtureFunctions, fixtureHeader } from "../pages/calcstep/calcStepFixture";
import { CalcStepPage } from "../pages/calcstep/CalcStepPage";
import { loanPaymentSetup } from "../pages/calcstep/stepSetup";
import { answerWith, callsOf, renderPage } from "../pages/spec/profileTesting";
import { savePage } from "./walkShot";
import { actionItem } from "../ui/pageHeader.test-support";

vi.mock("../wakala/mcp");

const emptyStep: CalcStepApi = {
  openStep: async () => fixtureHeader,
  listFunctions: async () => fixtureFunctions,
  chosenFunction: async () => null,
};

const cardOf = (title: string) => screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;

const shoot = (root: HTMLElement, name: string) => {
  if (process.env.WALK_SHOTS) savePage(root, process.env.WALK_SHOTS, name);
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("a builder builds the loan payment step from an empty step to a saved one", () => {
  it("sets up the function, the inputs, the step and the posting step, sees a sample run, and saves into the draft", async () => {
    answerWith({ agency_list_drafts: { items: [{ id: "d1" }] }, agency_update_work_item: {} });
    const user = userEvent.setup();
    renderPage(<CalcStepPage hubId="h1" stepId="work-out" api={emptyStep} setup={loanPaymentSetup} />, "calc-step");
    await screen.findByRole("heading", { level: 1, name: fixtureHeader.title });

    expect(await actionItem("Save step")).toBeDisabled();
    expect(within(cardOf("This step")).getByRole("alert")).toHaveTextContent(/Choose what happens when this step cannot work out a result/);
    shoot(document.body, "calculating-step-problems.html");

    await user.selectOptions(screen.getByLabelText("Function", { selector: "select" }), "fin.pmt@2");
    await user.selectOptions(screen.getByLabelText("Where principal comes from"), "ledger");
    await user.selectOptions(screen.getByLabelText("Where monthly_rate comes from"), "fixed");
    await user.type(screen.getByLabelText("Value for monthly_rate"), "0.01");
    await user.selectOptions(screen.getByLabelText("Where months comes from"), "fixed");
    await user.type(screen.getByLabelText("Value for months"), "12");
    await user.click(within(cardOf("This step")).getByRole("button", { name: "Stop and tell the person what is wrong" }));

    const sample = cardOf("Try it");
    const boxes = within(sample).getAllByRole("textbox");
    await user.type(boxes[0], "10000");
    await user.type(boxes[1], "0.01");
    await user.type(boxes[2], "12");
    await user.click(within(sample).getByRole("button", { name: "Run on this sample" }));
    expect(await within(sample).findByText("564.88")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Amount" }), "work-out");
    await user.selectOptions(screen.getByRole("combobox", { name: "Debit account" }), "cash");
    await user.selectOptions(screen.getByRole("combobox", { name: "Credit account" }), "member-loans");
    await user.type(screen.getByRole("textbox", { name: "Reason" }), "Loan payment for the month");
    expect(screen.getByText(/^Debits Cash and credits Member loans by the Monthly payment\./)).toBeInTheDocument();
    shoot(document.body, "calculating-step-set-up.html");
    shoot(cardOf("Post the payment").parentElement as HTMLElement, "calculating-step-posting.html");

    expect(await actionItem("Save step")).toBeEnabled();
    fireEvent.click(await actionItem("Save step"));
    await waitFor(() => expect(callsOf("agency_update_work_item")).toHaveLength(2));
    const [calculating, posting] = callsOf("agency_update_work_item") as Record<string, string>[];
    expect(calculating).toMatchObject({ work_item_id: "work-out", function: "fin.pmt@2", result_name: "Monthly payment", draft_id: "d1" });
    expect(JSON.parse(calculating.on_failure)).toEqual({ choice: "stop" });
    expect(JSON.parse(calculating.bindings).map((binding: { source_type: string }) => binding.source_type)).toEqual(["ledger_balance", "fixed", "fixed"]);
    expect(posting).toMatchObject({ work_item_id: "post", amount_step_id: "work-out", debit_account: "cash", credit_account: "member-loans", draft_id: "d1" });
    await waitFor(async () => expect(await actionItem("Save step")).toBeEnabled());
  });
});

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RuleBody } from "./RuleBody";
import { arrive, at, leave } from "./rulebookFixture";

beforeEach(arrive);

afterEach(leave);

const route = "/a/:agencyId/backlogs/rule/:ruleCode";

const shown = (text: string) => at("/a/hub-1/backlogs/rule/R-30", route, <RuleBody text={text} backLabel="R-30" />);

describe("a rule body", () => {
  it("links the decision named on its Approval line", () => {
    shown("Translations stay in step.\n\nApproval: D-32");
    expect(screen.getByRole("link", { name: "D-32" })).toHaveAttribute("href", "/a/hub-1/backlogs/rule/D-32");
  });

  it("keeps the words before the code and the text around the line", () => {
    shown("Translations stay in step.\n\nApproval: D-32.\n\nSee the languages folder.");
    expect(screen.getByText("Translations stay in step.")).toBeInTheDocument();
    expect(screen.getByText("See the languages folder.")).toBeInTheDocument();
    expect(screen.getByText(/^Approval:/)).toHaveTextContent("Approval: D-32.");
  });

  it("opens the decision and sends the back label with the way back", async () => {
    shown("Approval: D-32");
    await userEvent.click(screen.getByRole("link", { name: "D-32" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/rule/D-32");
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "")).toEqual({ backTo: "/a/hub-1/backlogs/rule/R-30", backLabel: "R-30" });
  });

  it("links every approval line it finds", () => {
    shown("Approval: D-32\n\nApproval: D-7");
    expect(screen.getAllByRole("link").map((one) => one.textContent)).toEqual(["D-32", "D-7"]);
  });

  it("leaves a body without an Approval line as plain text", () => {
    shown("Approval is a word. D-32 is mentioned later.");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Approval is a word. D-32 is mentioned later.")).toBeInTheDocument();
  });

  it("does not link a code that is not a decision code", () => {
    shown("Approval: R-30");
    expect(screen.queryByRole("link")).toBeNull();
  });
});

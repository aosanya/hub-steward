import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { StartStep } from "../coordinator/start/api";
import type { MemberStep } from "../steps/api";
import { forgetSent, markSent } from "../steps/sent";
import { StartRows } from "./StartRows";
import { joinGroupWorkflow } from "./workflowScreens";

const member = (over: Partial<MemberStep>): MemberStep => ({
  id: "s1",
  title: "Refer the case",
  formName: "Referral",
  roleName: "Volunteer",
  workflowName: "Case referral",
  opensIn: "form",
  agencyName: "",
  state: "start",
  orderId: "",
  recordCode: "REC-1",
  questions: [{ prompt: "Reason", answerType: "free_text", helper: "", required: true }],
  ...over,
});

const none = { openSteps: async (): Promise<StartStep[]> => [], waiting: async (): Promise<StartStep[]> => [] };

let landed = "";
let search = "";

const Where = () => {
  const here = useLocation();
  landed = here.pathname;
  search = here.search;
  return null;
};

const show = async (available: () => Promise<MemberStep[]>, start = none) => {
  landed = "";
  await act(async () => {
    render(
      <MemoryRouter>
        <StartRows start={start} steps={{ available }} />
        <Where />
      </MemoryRouter>,
    );
  });
};

const rows = () => Array.from(document.querySelectorAll<HTMLElement>(".rows .row"));

const titles = () => rows().map((row) => row.querySelector(".ttl")?.textContent ?? "");

beforeEach(() => openAgency("hub1"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetSent();
});

describe("the rows of the steps a member may act on now", () => {
  it("draws a row for a step that starts a run and one for a step waiting on her, each named for its form and opening its own step page", async () => {
    await show(async () => [member({}), member({ id: "s2", formName: "Confirm arrival", state: "waiting", orderId: "o7" })]);
    await screen.findByRole("button", { name: /^Referral/ });
    expect(titles()).toEqual(["Referral", "Confirm arrival"]);
    await userEvent.click(screen.getByRole("button", { name: /^Confirm arrival/ }));
    expect(landed).toBe("/a/hub1/steps/s2");
    expect(search).toBe("?order=o7");
  });

  it("names a row for the step's title when the step has no form name, and draws none for a step with neither", async () => {
    await show(async () => [member({ id: "t1", formName: "" }), member({ id: "e1", formName: "", title: "" })]);
    await screen.findByRole("button", { name: /^Refer the case/ });
    expect(titles()).toEqual(["Refer the case"]);
  });

  it("draws nothing for a member who holds no step to act on", async () => {
    await show(async () => []);
    expect(document.querySelector(".rows")).toBeNull();
  });

  it("leaves the farmers' own screens to their own rows: Join a group, the group order Start step and a chat step", async () => {
    const groupOrder = member({
      id: "g1",
      formName: "Create group order",
      questions: [
        { prompt: "Product", answerType: "free_text", helper: "" },
        { prompt: "Price", answerType: "currency", helper: "" },
        { prompt: "Minimum", answerType: "number", helper: "" },
      ],
    });
    await show(async () => [member({ id: "j1", formName: joinGroupWorkflow }), groupOrder, member({ id: "c1", opensIn: "chat", formName: "Advice" }), member({ id: "r1", formName: "Referral" })]);
    await screen.findByRole("button", { name: /^Referral/ });
    expect(titles()).toEqual(["Referral"]);
  });

  it("gives a step with a product, a price and a quantity its own generic row when its form is not the group order", async () => {
    const pooled = member({
      id: "p1",
      formName: "Group fertilizer order",
      questions: [
        { prompt: "Product", answerType: "free_text", helper: "" },
        { prompt: "Price a bag", answerType: "currency", helper: "" },
        { prompt: "Minimum bags", answerType: "number", helper: "" },
      ],
    });
    await show(async () => [pooled]);
    await screen.findByRole("button", { name: /^Group fertilizer order/ });
    expect(titles()).toEqual(["Group fertilizer order"]);
  });

  it("draws one row for each run of a step that is waiting on her in more than one", async () => {
    await show(async () => [member({ id: "s2", formName: "Confirm arrival", state: "waiting", orderId: "o7" }), member({ id: "s2", formName: "Confirm arrival", state: "waiting", orderId: "o8" })]);
    await screen.findAllByRole("button", { name: /^Confirm arrival/ });
    expect(titles()).toEqual(["Confirm arrival", "Confirm arrival"]);
    await userEvent.click(rows()[1]);
    expect(search).toBe("?order=o8");
  });

  it("marks only the run she sent as Sent", async () => {
    markSent({ id: "s2", orderId: "o7", title: "Confirm arrival" });
    await show(async () => [member({ id: "s2", formName: "Confirm arrival", state: "waiting", orderId: "o7" }), member({ id: "s2", formName: "Confirm arrival", state: "waiting", orderId: "o8" })]);
    await screen.findAllByText("Confirm arrival");
    expect(rows().map((row) => row.querySelector(".end")?.textContent)).toEqual(["Sent", "›"]);
  });

  it("draws the rows after the rows of the agency's cards", async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <StartRows kind="farmers" start={none} steps={{ available: async () => [member({})] }} />
        </MemoryRouter>,
      );
    });
    await screen.findByRole("button", { name: /^Referral/ });
    expect(titles()).toEqual(["Forms", "Referral"]);
  });

  it("marks a step she has just sent as Sent when the list no longer has it, with no chevron and nothing to open", async () => {
    markSent({ id: "s1", orderId: "r1", title: "Referral" });
    await show(async () => [member({ id: "s2", formName: "Confirm arrival", state: "waiting", orderId: "o7" })]);
    await screen.findByRole("button", { name: /^Confirm arrival/ });
    const sent = rows().find((row) => row.querySelector(".ttl")?.textContent === "Referral")!;
    expect(sent.tagName).toBe("DIV");
    expect(sent.querySelector(".end")).toHaveTextContent("Sent");
    expect(titles()).toEqual(["Confirm arrival", "Referral"]);
  });

  it("lists a row the member can start beside the Sent row of a run already sent, when the list still holds the step", async () => {
    markSent({ id: "s1", orderId: "r1", title: "Referral" });
    await show(async () => [member({})]);
    await screen.findByText("Sent");
    expect(titles()).toEqual(["Referral", "Referral"]);
    expect(rows().map((row) => row.querySelector(".end")?.textContent)).toEqual(["›", "Sent"]);
    expect(rows()[0].tagName).toBe("BUTTON");
    expect(rows()[1].tagName).toBe("DIV");
    await userEvent.click(rows()[0]);
    expect(landed).toBe("/a/hub1/steps/s1");
    expect(search).toBe("");
  });

  it("shows only the Sent rows of the agency that is open", async () => {
    markSent({ id: "s1", orderId: "r1", title: "Referral" });
    openAgency("hub2");
    await show(async () => [member({ id: "s2", formName: "Confirm arrival", state: "waiting", orderId: "o7" })]);
    await screen.findByRole("button", { name: /^Confirm arrival/ });
    expect(titles()).toEqual(["Confirm arrival"]);
    openAgency("hub1");
    cleanup();
    await show(async () => [member({ id: "s2", formName: "Confirm arrival", state: "waiting", orderId: "o7" })]);
    await screen.findByRole("button", { name: /^Confirm arrival/ });
    expect(titles()).toEqual(["Confirm arrival", "Referral"]);
  });

  it("draws no row and no alert when her steps cannot be read, since the old list carries the alert", async () => {
    await show(async () => Promise.reject(new Error("down")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.querySelector(".rows")).toBeNull();
  });
});

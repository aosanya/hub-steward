import { vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { StartRows } from "./StartRows";
import { forgetSent } from "../../features/steps/sent";
import { rowStepOf, type RowStepFact } from "./agencyHome_contract_adapters";

let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const tender = (action: RowStepFact["action"], over: Partial<RowStepFact> = {}) => rowStepOf({ id: `gen-${action}-tender`, record: "RC-1", action, name: `${action[0].toUpperCase()}${action.slice(1)} a tender`, ...over });

const designed = { ...rowStepOf({ id: "d1", record: "", action: "add", name: "Report a problem" }), generated: undefined, rowAction: undefined, formName: "Problem report" };

const show = async (available: unknown[]) => {
  landed = "";
  await act(async () => {
    render(
      <MemoryRouter>
        <StartRows
          kind="farmers"
          start={{ openSteps: async () => [], waiting: async () => [] }}
          steps={{ available: async () => available as never[] }}
          forms={{ waiting: async () => [], answered: async () => [] }}
        />
        <Where />
      </MemoryRouter>,
    );
  });
};

const titles = () => Array.from(document.querySelectorAll(".rows .row .ttl")).map((title) => title.textContent);

beforeEach(() => openAgency("farmers"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetSent();
  vi.restoreAllMocks();
});

describe("My work > Start lists the Add workflows", () => {
  it("lists the Add workflow of a record under its workflow name, not the form's name", async () => {
    await show([tender("add")]);
    expect(titles()).toContain("Add a tender");
  });

  it("lists no Edit and no Delete workflow, which start from a row", async () => {
    await show([tender("add"), tender("edit"), tender("delete")]);
    expect(titles()).toContain("Add a tender");
    expect(titles()).not.toContain("Edit a tender");
    expect(titles()).not.toContain("Delete a tender");
  });

  it("hides an Add that a designed workflow replaces, and lists the designed workflow", async () => {
    await show([tender("add", { replacedBy: "W-3" }), designed]);
    expect(titles()).not.toContain("Add a tender");
    expect(titles()).toContain("Problem report");
  });

  it("opens the Add workflow's form on its step", async () => {
    await show([tender("add")]);
    await userEvent.click(screen.getByText("Add a tender"));
    expect(landed).toBe("/a/farmers/steps/gen-add-tender");
  });

  it("lists an Add for every record the person may add to", async () => {
    await show([tender("add"), rowStepOf({ id: "gen-add-client", record: "RC-2", action: "add", name: "Add a client" })]);
    expect(titles()).toEqual(expect.arrayContaining(["Add a tender", "Add a client"]));
  });
});

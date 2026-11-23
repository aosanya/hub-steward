import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answerWith, callsOf, renderPage } from "../spec/profileTesting";
import { calcStepApi, newestOf, written, type CalcStepApi } from "./calcStepApi";
import { fixtureChoice, fixtureFunctions, fixtureHeader } from "./calcStepFixture";
import { CalcStepPage } from "./CalcStepPage";
import { actionItem, chooseAction } from "../../ui/pageHeader.test-support";

vi.mock("../../wakala/mcp");

const fakeApi = (more: Partial<CalcStepApi> = {}): CalcStepApi => ({
  openStep: vi.fn(async () => fixtureHeader),
  listFunctions: vi.fn(async () => fixtureFunctions),
  chosenFunction: vi.fn(async () => fixtureChoice),
  ...more,
});

const open = (api: CalcStepApi, onSave?: (saved: { stepId: string; function: string }) => void) =>
  renderPage(<CalcStepPage hubId="h1" stepId="s1" api={api} onSave={onSave} />, "calc-step");

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the calculating step page", () => {
  it("opens the step through the client and shows its title with Save step at the right end", async () => {
    open(fakeApi());
    expect(await screen.findByRole("heading", { level: 1, name: fixtureHeader.title })).toBeInTheDocument();
    expect(await actionItem("Save step")).toBeInTheDocument();
  });

  it("writes the function it calls with its version and says a newer one exists", async () => {
    open(fakeApi());
    expect(await screen.findByText("Version in use: fin.pmt@2")).toBeInTheDocument();
    expect(screen.getByText("A newer version exists: fin.pmt@3")).toBeInTheDocument();
  });

  it("moves to the newer version only when its button is pressed", async () => {
    open(fakeApi());
    await screen.findByText("Version in use: fin.pmt@2");
    expect(screen.queryByText("Version in use: fin.pmt@3")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Use version 3" }));
    expect(screen.getByText("Version in use: fin.pmt@3")).toBeInTheDocument();
    expect(screen.queryByText(/A newer version exists/)).toBeNull();
  });

  it("keeps Save step off until something is saved from it, then hands over the step and the function", async () => {
    const onSave = vi.fn();
    open(fakeApi(), onSave);
    await screen.findByText("Version in use: fin.pmt@2");
    fireEvent.click(screen.getByRole("button", { name: "Use version 3" }));
    await chooseAction("Save step");
    expect(onSave).toHaveBeenCalledWith({ stepId: "s1", function: "fin.pmt@3" });
  });

  it("keeps Save step off when the page was given nothing to save with", async () => {
    open(fakeApi());
    await screen.findByText("Version in use: fin.pmt@2");
    expect(await actionItem("Save step")).toBeDisabled();
  });

  it("says no function is picked for a step that has none", async () => {
    open(fakeApi({ chosenFunction: vi.fn(async () => null) }));
    expect(await screen.findByText("No function is picked yet.")).toBeInTheDocument();
  });

  it("says the step could not be loaded when the client fails", async () => {
    open(fakeApi({ openStep: vi.fn(async () => Promise.reject(new Error("down"))) }));
    expect(await screen.findByText("The page could not be loaded.")).toBeInTheDocument();
  });
});

describe("the typed client", () => {
  it("opens one step with agency_get_work_item and keeps only its code and title", async () => {
    answerWith({ agency_get_work_item: { id: "s1", code: "WI-7", title: "Work out the monthly payment", workflow_id: "w1" } });
    const header = await calcStepApi.openStep("h1", "s1");
    expect(header).toEqual({ id: "s1", code: "WI-7", title: "Work out the monthly payment" });
    expect(callsOf("agency_get_work_item")).toEqual([{ work_item_id: "s1" }]);
  });

  it("writes a function with its version and finds the newest version", () => {
    expect(written({ name: "fin.pmt", version: 2 })).toBe("fin.pmt@2");
    expect(newestOf({ name: "fin.pmt", versions: [1, 3, 2], about: "" })).toBe(3);
  });

  it("serves the functions, their versions and the step's choice from the fixture until the host calls exist", async () => {
    expect(await calcStepApi.listFunctions("h1")).toEqual(fixtureFunctions);
    expect(await calcStepApi.chosenFunction("h1", "s1")).toEqual(fixtureChoice);
    await waitFor(() => expect(callsOf("agency_list_work_items")).toEqual([]));
  });
});

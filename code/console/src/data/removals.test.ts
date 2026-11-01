import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpError, callTool } from "../wakala/mcp";
import { removeScenario, removeWorkflow } from "./removals";
import { loadScenarios, type Scenario } from "./scenario";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));
vi.mock("./scenario");

const callToolMock = vi.mocked(callTool);
const loadScenariosMock = vi.mocked(loadScenarios);

const scenario = (id: string, workflowId: string) => ({ id, workflowId }) as Scenario;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("removing a workflow", () => {
  it("is removed when the tool accepts", async () => {
    callToolMock.mockResolvedValue({} as never);
    expect(await removeWorkflow("h", "w1")).toEqual({ kind: "removed" });
    expect(callToolMock).toHaveBeenCalledWith("h", "agency_delete_workflow", { workflow_id: "w1" });
    expect(loadScenariosMock).not.toHaveBeenCalled();
  });

  it("is refused with exactly the scenarios that mirror it", async () => {
    callToolMock.mockRejectedValue(new McpError("in use"));
    loadScenariosMock.mockResolvedValue([scenario("a", "w1"), scenario("b", "w2"), scenario("c", "w1")]);
    const outcome = await removeWorkflow("h", "w1");
    expect(outcome.kind).toBe("refused");
    expect(outcome.kind === "refused" && outcome.scenarios.map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("rethrows the refusal when no scenario explains it", async () => {
    const error = new McpError("some other reason");
    callToolMock.mockRejectedValue(error);
    loadScenariosMock.mockResolvedValue([scenario("b", "w2")]);
    await expect(removeWorkflow("h", "w1")).rejects.toBe(error);
  });

  it("rethrows the refusal when the scenarios cannot be listed", async () => {
    const error = new McpError("refused");
    callToolMock.mockRejectedValue(error);
    loadScenariosMock.mockRejectedValue(new Error("down"));
    await expect(removeWorkflow("h", "w1")).rejects.toBe(error);
  });

  it("does not look for scenarios when the failure is not a tool refusal", async () => {
    const error = new TypeError("network");
    callToolMock.mockRejectedValue(error);
    await expect(removeWorkflow("h", "w1")).rejects.toBe(error);
    expect(loadScenariosMock).not.toHaveBeenCalled();
  });
});

describe("removing a scenario", () => {
  it("asks for that scenario to go", async () => {
    callToolMock.mockResolvedValue({} as never);
    await removeScenario("h", "s1");
    expect(callToolMock).toHaveBeenCalledWith("h", "agency_delete_scenario", { scenario_id: "s1" });
  });

  it("lets a refusal through", async () => {
    callToolMock.mockRejectedValue(new McpError("no"));
    await expect(removeScenario("h", "s1")).rejects.toThrow("no");
  });
});

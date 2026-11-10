import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { removeScenario } from "../../data/removals";
import { runOne, runScenarios, type Scenario } from "../../data/scenario";
import { removeFailedText, useScenarioActions } from "./useScenarioActions";

const navigate = vi.fn();
const tellChat = vi.fn();

vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("../../i18n", () => ({ useI18n: () => ({ t: (key: string) => (key === "test.removeFailed" ? "Could not remove {name}" : key) }) }));
vi.mock("../../shell/chatTell", () => ({ useTellChat: () => tellChat }));
vi.mock("../../data/removals");
vi.mock("../../data/scenario", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../data/scenario")>()),
  runOne: vi.fn(),
  runScenarios: vi.fn(),
}));

const scenario = (id: string, name = `Scenario ${id}`) => ({ id, name }) as Scenario;
const scenarios = [scenario("a"), scenario("b"), scenario("c")];
const reload = vi.fn();

const setup = () => renderHook(() => useScenarioActions("h1", scenarios, reload));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ticking scenarios", () => {
  it("adds and removes ids from the ticked set", () => {
    const { result } = setup();

    act(() => result.current.tick("a", true));
    act(() => result.current.tick("b", true));
    expect([...result.current.ticked]).toEqual(["a", "b"]);

    act(() => result.current.tick("a", false));
    expect([...result.current.ticked]).toEqual(["b"]);
  });
});

describe("running one scenario", () => {
  it("shows it running, opens the run it started, then reloads", async () => {
    vi.mocked(runOne).mockResolvedValue("run-7");
    const { result } = setup();

    act(() => result.current.runOne(scenario("a")));
    expect([...result.current.running]).toEqual(["a"]);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/h/h1/test?run=run-7"));
    await waitFor(() => expect(result.current.running.size).toBe(0));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(runOne).toHaveBeenCalledWith("h1", "a");
  });

  it("stays on the page when the hub gave no run id", async () => {
    vi.mocked(runOne).mockResolvedValue("");
    const { result } = setup();

    act(() => result.current.runOne(scenario("a")));

    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
  });

  it("says why when the hub refuses, with the tool prefix removed", async () => {
    vi.mocked(runOne).mockRejectedValue(new Error("agency_run_scenario: nothing to run"));
    const { result } = setup();

    act(() => result.current.runOne(scenario("a")));

    await waitFor(() => expect(result.current.refusal).toBe("nothing to run"));
    expect(result.current.running.size).toBe(0);
    expect(reload).toHaveBeenCalled();
  });

  it("falls back to the not-started text when the failure has no words", async () => {
    vi.mocked(runOne).mockRejectedValue("boom");
    const { result } = setup();

    act(() => result.current.runOne(scenario("a")));

    await waitFor(() => expect(result.current.refusal).toBe("test.runNotStarted"));
  });

  it("clears an earlier refusal when the next run starts", async () => {
    vi.mocked(runOne).mockRejectedValueOnce(new Error("no"));
    vi.mocked(runOne).mockResolvedValueOnce("run-2");
    const { result } = setup();

    act(() => result.current.runOne(scenario("a")));
    await waitFor(() => expect(result.current.refusal).toBe("no"));
    act(() => result.current.runOne(scenario("a")));

    expect(result.current.refusal).toBe("");
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/h/h1/test?run=run-2"));
  });
});

describe("the primary run button", () => {
  it("runs the whole set, marking every scenario running, when none is ticked", async () => {
    vi.mocked(runScenarios).mockResolvedValue(undefined);
    const { result } = setup();

    act(() => result.current.runPrimary([])());

    expect([...result.current.running]).toEqual(["a", "b", "c"]);
    await waitFor(() => expect(runScenarios).toHaveBeenCalledWith("h1", []));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it("runs only the chosen scenarios by id", async () => {
    vi.mocked(runScenarios).mockResolvedValue(undefined);
    const { result } = setup();

    act(() => result.current.runPrimary([scenarios[1], scenarios[2]])());

    expect([...result.current.running]).toEqual(["b", "c"]);
    await waitFor(() => expect(runScenarios).toHaveBeenCalledWith("h1", ["b", "c"]));
  });
});

describe("removing a scenario", () => {
  it("asks first, and cancelling forgets the choice", () => {
    const { result } = setup();

    act(() => result.current.askRemove(scenarios[0]));
    expect(result.current.removing).toBe("a");

    act(() => result.current.cancelRemove());
    expect(result.current.removing).toBe("");
  });

  it("removes the chosen scenario, reloads and closes the question", async () => {
    vi.mocked(removeScenario).mockResolvedValue(undefined);
    const { result } = setup();

    act(() => result.current.askRemove(scenarios[1]));
    await act(() => result.current.confirmRemove());

    expect(removeScenario).toHaveBeenCalledWith("h1", "b");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.removing).toBe("");
    expect(result.current.busy).toBe(false);
    expect(result.current.failedName).toBe("");
  });

  it("tells the chat and names the scenario when the hub refuses, and does not reload", async () => {
    vi.mocked(removeScenario).mockRejectedValue(new Error("in use"));
    const { result } = setup();

    act(() => result.current.askRemove(scenarios[2]));
    await act(() => result.current.confirmRemove());

    expect(result.current.failedName).toBe("Scenario c");
    expect(tellChat).toHaveBeenCalledWith("Could not remove Scenario c");
    expect(reload).not.toHaveBeenCalled();
    expect(result.current.removing).toBe("");
  });

  it("forgets an earlier failure when another removal is asked", async () => {
    vi.mocked(removeScenario).mockRejectedValue(new Error("in use"));
    const { result } = setup();

    act(() => result.current.askRemove(scenarios[0]));
    await act(() => result.current.confirmRemove());
    act(() => result.current.askRemove(scenarios[1]));

    expect(result.current.failedName).toBe("");
  });

  it("does nothing when no scenario was chosen", async () => {
    const { result } = setup();

    await act(() => result.current.confirmRemove());

    expect(removeScenario).not.toHaveBeenCalled();
  });
});

describe("opening the add form", () => {
  it("goes to the test page with add=1", () => {
    const { result } = setup();

    act(() => result.current.openAdd());

    expect(navigate).toHaveBeenCalledWith("/h/h1/test?add=1");
  });
});

describe("the removal failure sentence", () => {
  it("puts the scenario's name where the placeholder is", () => {
    expect(removeFailedText((key) => `Could not remove {name} (${key})`, "Join")).toBe("Could not remove Join (test.removeFailed)");
  });
});

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../wakala/mcp";
import { mcpSendClient, targetsOf } from "./api";
import { withoutCurrent } from "./leftOut";
import { useSelection } from "./selection";
import type { Target } from "./types";
import { landsAtWords, noTargetsWords, outcomeWords, selectedWords, sheetTitleWords } from "./words";

const software: Target = { backlogId: "b1", name: "Software", stepId: "s1", stepName: "To do" };
const docs: Target = { backlogId: "b2", name: "Documentation", stepId: "d1", stepName: "Draft" };

beforeEach(() => vi.restoreAllMocks());

describe("what can be sent where", () => {
  it("lists no backlog that has no id or no steps", () => {
    const reply = { items: [{ name: "No id", steps: [{ id: "x", name: "A" }] }, { id: "b9", name: "No steps", steps: [] }, { id: "b1", name: "Software", steps: [{ id: "s1", name: "To do" }] }] };
    expect(targetsOf(reply)).toEqual([software]);
  });

  it("lists a bare array of backlogs, and nothing for an empty reply", () => {
    expect(targetsOf([{ id: "b1", name: "Software", steps: [{ id: "s1", name: "To do" }] }])).toEqual([software]);
    expect(targetsOf({})).toEqual([]);
    expect(targetsOf(undefined)).toEqual([]);
  });

  it("lands at the first step that has a name", () => {
    const reply = { items: [{ id: "b1", name: "Software", steps: [{ id: "x", name: "" }, { id: "s1", name: "To do" }] }] };
    expect(targetsOf(reply)[0]).toMatchObject({ stepId: "s1", stepName: "To do" });
  });

  it("keeps every target when nothing is selected", () => {
    expect(withoutCurrent([software, docs], [])).toEqual([software, docs]);
  });

  it("drops the backlog of a selection that is all in it, but not when only some are", () => {
    expect(withoutCurrent([software, docs], ["b1", "b1"])).toEqual([docs]);
    expect(withoutCurrent([software, docs], ["b1", "b2"])).toEqual([software, docs]);
  });
});

describe("sending", () => {
  it("sends nothing and says nothing was refused for an empty selection", async () => {
    const call = vi.spyOn(mcp, "callTool");
    expect(await mcpSendClient.send([], software)).toEqual({ sent: 0, refusal: "" });
    expect(call).not.toHaveBeenCalled();
  });

  it("says the move was refused when the failure has no words of the hub", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new TypeError("offline"));
    expect(await mcpSendClient.send(["t1"], software)).toEqual({ sent: 0, refusal: "The move was refused." });
  });

  it("reads the targets through the backlogs tool", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [{ id: "b2", name: "Documentation", steps: [{ id: "d1", name: "Draft" }] }] } as never);
    expect(await mcpSendClient.targets()).toEqual([docs]);
  });
});

describe("the words of sending", () => {
  it("counts the selection, the sheet title and where the issues land", () => {
    expect(selectedWords(0)).toBe("0 selected");
    expect(selectedWords(3)).toBe("3 selected");
    expect(sheetTitleWords(1)).toBe("Send 1 issue to");
    expect(sheetTitleWords(2)).toBe("Send 2 issues to");
    expect(landsAtWords(docs)).toBe("lands at Draft");
    expect(noTargetsWords).toBe("No backlog to send to");
  });

  it("says how many went when the hub refused part of a send, and none went", () => {
    expect(outcomeWords({ sent: 0, refusal: "no" }, 2, docs)).toBe("0 of 2 sent to Documentation. no");
    expect(outcomeWords({ sent: 2, refusal: "" }, 2, docs)).toBe("2 issues sent to Documentation");
  });
});

describe("the selection", () => {
  it("does not tick an issue twice", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.toggle("a", true));
    act(() => result.current.toggle("a", true));
    expect(result.current.ids).toEqual(["a"]);
    expect(result.current.count).toBe(1);
  });

  it("unticking an issue that was never ticked changes nothing", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.toggle("a", true));
    act(() => result.current.toggle("b", false));
    expect(result.current.ids).toEqual(["a"]);
  });

  it("replaces the ticks with the rows shown on All, and forgets them on Cancel", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.start());
    act(() => result.current.toggle("a", true));
    act(() => result.current.selectAll(["x", "y"]));
    expect(result.current.ids).toEqual(["x", "y"]);
    expect(result.current.has("a")).toBe(false);
    expect(result.current.on).toBe(true);
    act(() => result.current.cancel());
    expect(result.current.on).toBe(false);
    expect(result.current.ids).toEqual([]);
  });
});

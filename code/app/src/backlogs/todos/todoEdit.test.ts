import { refusalOf, waitChoices, waitingOn } from "./todoEdit";
import type { Todo } from "./todoTree";

const todo = (number: number, waitsOn: string[] = []): Todo => ({ id: `t${number}`, number, title: `Piece ${number}`, status: "pending", waitsOn, blockedReason: "" });

const chain = [todo(1), todo(2, ["t1"]), todo(3, ["t2"]), todo(4, ["t3"]), todo(5)];

describe("what a piece may wait on", () => {
  it("finds every piece that waits on it, directly or through others", () => {
    expect([...waitingOn(chain[1], chain)].sort()).toEqual(["t3", "t4"]);
  });

  it("offers the other pieces except those, in order of number", () => {
    expect(waitChoices(chain[1], chain).map((one) => one.number)).toEqual([1, 5]);
    expect(waitChoices(chain[0], chain).map((one) => one.number)).toEqual([5]);
  });

  it("does not loop on a cycle already in the data", () => {
    const loop = [todo(1, ["t2"]), todo(2, ["t1"])];
    expect([...waitingOn(loop[0], loop)].sort()).toEqual(["t1", "t2"]);
  });
});

describe("the words of a refused change", () => {
  it("drops the tool name from the front of the API's message", () => {
    expect(refusalOf(new Error("taskmanager_task_todo_update: that would make a cycle"))).toBe("that would make a cycle");
  });

  it("keeps a message that has no tool name and falls back to a plain line when there is none", () => {
    expect(refusalOf(new Error("Network down"))).toBe("Network down");
    expect(refusalOf("nope")).toBe("The change was not made.");
    expect(refusalOf(new Error(""))).toBe("The change was not made.");
  });
});

import { countOf, statusOf, treeOf, type Todo } from "./todoTree";

const todo = (number: number, over: Partial<Todo> = {}): Todo => ({ id: `t${number}`, number, title: `Piece ${number}`, status: "pending", waitsOn: [], blockedReason: "", ...over });

const cleanup = [
  todo(1, { status: "completed" }),
  todo(2, { status: "completed", waitsOn: ["t1"] }),
  todo(3, { status: "dispatched", waitsOn: ["t1"] }),
  todo(4, { waitsOn: ["t1"] }),
  todo(5, { waitsOn: ["t1"] }),
  todo(6, { status: "blocked", waitsOn: ["t2", "t3", "t4", "t5"] }),
];

describe("the status of a todo", () => {
  it("maps pending to To do, dispatched to In progress, completed to Done, blocked and failed to Blocked", () => {
    expect(["pending", "dispatched", "completed", "blocked", "failed"].map(statusOf)).toEqual(["todo", "progress", "done", "blocked", "blocked"]);
  });

  it("reads a status it does not know as To do", () => {
    expect(statusOf("skipped")).toBe("todo");
    expect(statusOf(undefined)).toBe("todo");
  });
});

describe("the count of a todo list", () => {
  it("counts the Done pieces out of all pieces", () => {
    expect(countOf(cleanup)).toEqual({ done: 2, total: 6 });
  });

  it("does not count a Blocked piece as Done", () => {
    expect(countOf([todo(1, { status: "blocked", blockedReason: "why" }), todo(2, { status: "failed" })])).toEqual({ done: 0, total: 2 });
  });

  it("is zero of zero for an empty list", () => {
    expect(countOf([])).toEqual({ done: 0, total: 0 });
  });
});

describe("the tree of a todo list", () => {
  it("puts pieces that wait on one piece one step in under it, and a piece that waits on several under the last of them", () => {
    expect(treeOf(cleanup).map((row) => [row.todo.number, row.depth])).toEqual([
      [1, 0],
      [2, 1],
      [3, 1],
      [4, 1],
      [5, 1],
      [6, 2],
    ]);
  });

  it("lists the numbers a piece waits on, smallest first", () => {
    const rows = treeOf(cleanup);
    expect(rows[0].waitsOn).toEqual([]);
    expect(rows[1].waitsOn).toEqual([1]);
    expect(rows[5].waitsOn).toEqual([2, 3, 4, 5]);
  });

  it("keeps a piece's children under it even when a later root comes between them in the list", () => {
    const rows = treeOf([todo(1), todo(2), todo(3, { waitsOn: ["t1"] }), todo(4, { waitsOn: ["t2"] })]);
    expect(rows.map((row) => [row.todo.number, row.depth])).toEqual([
      [1, 0],
      [3, 1],
      [2, 0],
      [4, 1],
    ]);
  });

  it("follows the order of the list, not the order the numbers were minted in", () => {
    const rows = treeOf([todo(7), todo(3), todo(5, { waitsOn: ["t7"] })]);
    expect(rows.map((row) => row.todo.number)).toEqual([7, 5, 3]);
  });

  it("shows the reason a person typed under a Blocked piece", () => {
    const rows = treeOf([todo(1), todo(2, { status: "blocked", waitsOn: ["t1"], blockedReason: "Waiting for the owner." })]);
    expect(rows[1].reason).toBe("Waiting for the owner.");
  });

  it("says a Blocked piece with no typed reason waits on as many pieces as are not Done", () => {
    expect(treeOf(cleanup)[5].reason).toBe("waits on 3 pieces");
    const one = treeOf([todo(1), todo(2, { status: "blocked", waitsOn: ["t1"] })]);
    expect(one[1].reason).toBe("waits on 1 piece");
  });

  it("shows no reason for a Blocked piece with nothing open to wait on, or for a piece that is not Blocked", () => {
    const rows = treeOf([todo(1, { status: "completed" }), todo(2, { status: "failed", waitsOn: ["t1"] }), todo(3)]);
    expect(rows.map((row) => row.reason)).toEqual(["", "", ""]);
  });

  it("ignores a dependency that is not in the list", () => {
    const rows = treeOf([todo(1, { waitsOn: ["gone"] })]);
    expect(rows[0].depth).toBe(0);
    expect(rows[0].waitsOn).toEqual([]);
  });

  it("still lists every piece when the dependencies loop", () => {
    const rows = treeOf([todo(1, { waitsOn: ["t2"] }), todo(2, { waitsOn: ["t1"] })]);
    expect(rows.map((row) => row.todo.number).sort()).toEqual([1, 2]);
  });

  it("is empty for an empty list", () => {
    expect(treeOf([])).toEqual([]);
  });
});

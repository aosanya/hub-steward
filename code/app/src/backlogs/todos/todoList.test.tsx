import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { openAgency } from "../../agency/open";
import { TodoList } from "./TodoList";
import type { TodosClient } from "./api";
import type { Todo } from "./todoTree";

const todo = (number: number, over: Partial<Todo> = {}): Todo => ({ id: `t${number}`, number, title: `Piece ${number} title`, status: "pending", waitsOn: [], blockedReason: "", ...over });

const cleanup: Todo[] = [
  todo(1, { status: "completed" }),
  todo(2, { status: "completed", waitsOn: ["t1"] }),
  todo(3, { status: "dispatched", waitsOn: ["t1"] }),
  todo(4, { waitsOn: ["t1"], status: "blocked", blockedReason: "Waiting for the owner." }),
  todo(5, { waitsOn: ["t1"] }),
  todo(6, { status: "blocked", waitsOn: ["t2", "t3", "t4", "t5"] }),
];

const clientOf = (read: () => Promise<Todo[]>): TodosClient => ({ list: vi.fn(read) });

const show = (client: TodosClient) => render(<TodoList issueId="i1" client={client} />);

const rowOf = (title: string) => screen.getByText(title).closest(".todo") as HTMLElement;

beforeEach(() => openAgency({ id: "hub-1", name: "Hub" } as never));

describe("the todo list of an issue", () => {
  it("says Loading while the pieces are read", () => {
    show(clientOf(() => new Promise(() => {})));
    expect(screen.getByText("Todo list")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("reads the pieces of the issue it sits on", async () => {
    const client = clientOf(async () => cleanup);
    show(client);
    await screen.findByText("Piece 1 title");
    expect(client.list).toHaveBeenCalledWith("i1");
  });

  it("heads the list with the count of pieces Done out of all", async () => {
    show(clientOf(async () => cleanup));
    expect(await screen.findByText("2 of 6 done")).toBeInTheDocument();
    expect(screen.getByText("Todo list")).toBeInTheDocument();
  });

  it("shows each piece with its number, its title and a status chip", async () => {
    show(clientOf(async () => cleanup));
    await screen.findByText("Piece 1 title");
    const chips = ["Done", "Done", "In progress", "Blocked", "To do", "Blocked"];
    chips.forEach((chip, at) => {
      const row = rowOf(`Piece ${at + 1} title`);
      expect(within(row).getByText(String(at + 1))).toBeInTheDocument();
      expect(within(row).getByText(chip)).toBeInTheDocument();
    });
  });

  it("colours the chips Done green, In progress blue and Blocked red, and leaves To do plain", async () => {
    show(clientOf(async () => cleanup));
    await screen.findByText("Piece 1 title");
    expect(within(rowOf("Piece 1 title")).getByText("Done")).toHaveClass("success");
    expect(within(rowOf("Piece 3 title")).getByText("In progress")).toHaveClass("info");
    expect(within(rowOf("Piece 4 title")).getByText("Blocked")).toHaveClass("danger");
    expect(within(rowOf("Piece 5 title")).getByText("To do").className).toBe("chip");
  });

  it("shows a waits on line with the numbers a piece waits on, and none for a piece that waits on nothing", async () => {
    show(clientOf(async () => cleanup));
    await screen.findByText("Piece 1 title");
    expect(within(rowOf("Piece 1 title")).queryByText(/waits on/)).toBeNull();
    expect(within(rowOf("Piece 2 title")).getByText("waits on 1")).toBeInTheDocument();
    expect(within(rowOf("Piece 6 title")).getByText("waits on 2, 3, 4, 5")).toBeInTheDocument();
  });

  it("indents a piece one step in under the last piece it waits on", async () => {
    show(clientOf(async () => cleanup));
    await screen.findByText("Piece 1 title");
    const depths = [1, 2, 3, 4, 5, 6].map((n) => rowOf(`Piece ${n} title`).style.getPropertyValue("--depth"));
    expect(depths).toEqual(["0", "1", "1", "1", "1", "2"]);
  });

  it("lists a piece's children directly under it", async () => {
    show(clientOf(async () => [todo(1), todo(2), todo(3, { waitsOn: ["t1"] }), todo(4, { waitsOn: ["t2"] })]));
    await screen.findByText("Piece 1 title");
    const order = Array.from(document.querySelectorAll(".todo .ttl")).map((one) => one.textContent);
    expect(order).toEqual(["Piece 1 title", "Piece 3 title", "Piece 2 title", "Piece 4 title"]);
  });

  it("shows the reason a person typed under a Blocked piece", async () => {
    show(clientOf(async () => cleanup));
    await screen.findByText("Piece 1 title");
    const why = within(rowOf("Piece 4 title")).getByText("Waiting for the owner.");
    expect(why).toHaveClass("why");
  });

  it("says a piece blocked by the pieces it waits on waits on that many pieces", async () => {
    show(clientOf(async () => cleanup));
    await screen.findByText("Piece 1 title");
    expect(within(rowOf("Piece 6 title")).getByText("waits on 3 pieces")).toHaveClass("why");
  });

  it("draws no editing control: no row menu and no Add a piece line", async () => {
    show(clientOf(async () => cleanup));
    await screen.findByText("Piece 1 title");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/Add a piece/)).toBeNull();
  });

  it("shows an empty list as its heading and one line, with no count and no editing control", async () => {
    show(clientOf(async () => []));
    expect(await screen.findByText("No pieces yet.")).toBeInTheDocument();
    expect(screen.getByText("Todo list")).toBeInTheDocument();
    expect(screen.queryByText(/of 0/)).toBeNull();
    expect(screen.queryByText(/done/)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says a failed read failed, with Try again, and never reads as empty", async () => {
    show(clientOf(async () => Promise.reject(new Error("down"))));
    expect(await screen.findByRole("alert")).toHaveTextContent("The todo list could not be loaded.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("No pieces yet.")).toBeNull();
    expect(screen.queryByText(/done/)).toBeNull();
  });

  it("reads again on Try again and shows the pieces when the second read answers", async () => {
    const list = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue(cleanup);
    show({ list });
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Piece 1 title")).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

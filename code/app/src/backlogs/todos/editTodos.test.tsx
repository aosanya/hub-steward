import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { openAgency } from "../../agency/open";
import { TodoList } from "./TodoList";
import type { TodosClient } from "./api";
import type { Todo } from "./todoTree";

const todo = (number: number, over: Partial<Todo> = {}): Todo => ({ id: `t${number}`, number, title: `Piece ${number} title`, status: "pending", waitsOn: [], blockedReason: "", ...over });

const pieces: Todo[] = [todo(1, { status: "completed" }), todo(2, { waitsOn: ["t1"] }), todo(3, { waitsOn: ["t2"] }), todo(4, { waitsOn: ["t1"] })];

const quick = () => vi.fn(async () => {});

const clientOf = (read: () => Promise<Todo[]>, over: Partial<TodosClient> = {}): TodosClient => ({
  list: vi.fn(read),
  add: quick(),
  rename: quick(),
  setWaitsOn: quick(),
  setStatus: quick(),
  block: quick(),
  remove: quick(),
  reorder: quick(),
  ...over,
});

const show = (client: TodosClient) => render(<TodoList issueId="i1" client={client} />);

const rowOf = (title: string) => screen.getByText(title).closest(".todo") as HTMLElement;

const openMenu = async (number: number) => userEvent.click(screen.getByRole("button", { name: `Piece ${number} menu` }));

const choose = async (number: number, action: string) => {
  await openMenu(number);
  await userEvent.click(screen.getByRole("button", { name: action }));
};

beforeEach(() => openAgency({ id: "hub-1", name: "Hub" } as never));

describe("the row menu of a piece", () => {
  it("ends every row in a menu button that opens Rename, Waits on, Set status, Mark Blocked and Delete", async () => {
    show(clientOf(async () => pieces));
    await screen.findByText("Piece 1 title");
    expect(screen.getAllByRole("button", { name: /^Piece \d menu$/ })).toHaveLength(4);
    await openMenu(4);
    ["Rename", "Waits on", "Set status", "Mark Blocked", "Delete"].forEach((action) => expect(screen.getByRole("button", { name: action })).toBeInTheDocument());
  });

  it("draws no menu when the client cannot write", async () => {
    show({ list: async () => pieces });
    await screen.findByText("Piece 1 title");
    expect(screen.queryByRole("button", { name: /menu/ })).toBeNull();
    expect(screen.queryByText(/Add a piece/)).toBeNull();
  });

  it("renames a piece from a field that starts with its title, saves on Done and reads the list again", async () => {
    const client = clientOf(async () => pieces);
    show(client);
    await screen.findByText("Piece 1 title");
    await choose(4, "Rename");
    const field = screen.getByRole("textbox", { name: "Piece 4 · Title" });
    expect(field).toHaveValue("Piece 4 title");
    await userEvent.clear(field);
    await userEvent.type(field, "Check every link");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(client.rename).toHaveBeenCalledWith("t4", "Check every link");
    await vi.waitFor(() => expect(client.list).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("keeps Done off until the title holds something and closes on Cancel without writing", async () => {
    const client = clientOf(async () => pieces);
    show(client);
    await screen.findByText("Piece 1 title");
    await choose(4, "Rename");
    await userEvent.clear(screen.getByRole("textbox"));
    expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(client.rename).not.toHaveBeenCalled();
  });

  it("deletes a piece and reads the list again", async () => {
    const client = clientOf(async () => pieces);
    show(client);
    await screen.findByText("Piece 1 title");
    await choose(4, "Delete");
    expect(client.remove).toHaveBeenCalledWith("t4");
    await vi.waitFor(() => expect(client.list).toHaveBeenCalledTimes(2));
  });

  it("offers as waits on the pieces that do not wait on it, ticks the ones it waits on, and saves the new ids", async () => {
    const client = clientOf(async () => pieces);
    show(client);
    await screen.findByText("Piece 1 title");
    await choose(2, "Waits on");
    expect(screen.getByRole("checkbox", { name: "1 Piece 1 title" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "4 Piece 4 title" })).not.toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "2 Piece 2 title" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "3 Piece 3 title" })).toBeNull();
    await userEvent.click(screen.getByRole("checkbox", { name: "4 Piece 4 title" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(client.setWaitsOn).toHaveBeenCalledWith("t2", ["t1", "t4"]);
    await vi.waitFor(() => expect(client.list).toHaveBeenCalledTimes(2));
  });

  it("clears what a piece waits on when every box is unticked", async () => {
    const client = clientOf(async () => pieces);
    show(client);
    await screen.findByText("Piece 1 title");
    await choose(4, "Waits on");
    await userEvent.click(screen.getByRole("checkbox", { name: "1 Piece 1 title" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(client.setWaitsOn).toHaveBeenCalledWith("t4", []);
  });

  it("writes a status at once from Set status", async () => {
    const client = clientOf(async () => pieces);
    show(client);
    await screen.findByText("Piece 1 title");
    await choose(4, "Set status");
    ["To do", "In progress", "Done", "Blocked"].forEach((word) => expect(within(rowOf("Piece 4 title")).getByRole("button", { name: word })).toBeInTheDocument());
    await userEvent.click(within(rowOf("Piece 4 title")).getByRole("button", { name: "In progress" }));
    expect(client.setStatus).toHaveBeenCalledWith("t4", "In progress");
    await vi.waitFor(() => expect(client.list).toHaveBeenCalledTimes(2));
  });

  it("asks why when a piece is marked Blocked, keeps Mark Blocked off until something is typed, and writes the reason", async () => {
    const client = clientOf(async () => pieces);
    show(client);
    await screen.findByText("Piece 1 title");
    await choose(4, "Mark Blocked");
    expect(screen.getByRole("textbox", { name: "Piece 4 · Why is it blocked?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Blocked" })).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox"), "Waiting for the owner.");
    await userEvent.click(screen.getByRole("button", { name: "Mark Blocked" }));
    expect(client.block).toHaveBeenCalledWith("t4", "Waiting for the owner.");
    expect(client.setStatus).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(client.list).toHaveBeenCalledTimes(2));
  });

  it("asks for the reason too when Blocked is chosen under Set status, and Cancel writes nothing", async () => {
    const client = clientOf(async () => pieces);
    show(client);
    await screen.findByText("Piece 1 title");
    await choose(4, "Set status");
    await userEvent.click(screen.getByRole("button", { name: "Blocked" }));
    expect(screen.getByRole("textbox", { name: "Piece 4 · Why is it blocked?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(client.block).not.toHaveBeenCalled();
    expect(client.setStatus).not.toHaveBeenCalled();
  });

  it("lifts a block by hand with To do, which sends no reason, and the reason is gone once the list is read again", async () => {
    let held: Todo[] = [...pieces.slice(0, 3), todo(4, { waitsOn: ["t1"], status: "blocked", blockedReason: "Waiting for the owner." })];
    const client = clientOf(async () => held, {
      setStatus: vi.fn(async () => {
        held = pieces;
      }),
    });
    show(client);
    expect(await screen.findByText("Waiting for the owner.")).toBeInTheDocument();
    await choose(4, "Set status");
    await userEvent.click(screen.getByRole("button", { name: "To do" }));
    expect(client.setStatus).toHaveBeenCalledWith("t4", "To do");
    await vi.waitFor(() => expect(screen.queryByText("Waiting for the owner.")).toBeNull());
    expect(within(rowOf("Piece 4 title")).queryByText("Blocked")).toBeNull();
  });

  it("shows the API's message on the row when a cycle is refused, keeps the form open and does not read the list again", async () => {
    const refused = "taskmanager_task_todo_update: that would make a piece wait, directly or through others, on itself";
    const client = clientOf(async () => pieces, { setWaitsOn: vi.fn(async () => Promise.reject(new Error(refused))) });
    show(client);
    await screen.findByText("Piece 1 title");
    await choose(2, "Waits on");
    await userEvent.click(screen.getByRole("checkbox", { name: "4 Piece 4 title" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("that would make a piece wait, directly or through others, on itself");
    expect(alert.closest(".todo-edit")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(client.list).toHaveBeenCalledTimes(1);
  });

  it("shows the API's message under the row when a status or a delete is refused", async () => {
    const client = clientOf(async () => pieces, {
      setStatus: vi.fn(async () => Promise.reject(new Error("taskmanager_task_todo_set_status: you need Can move on this backlog"))),
      remove: vi.fn(async () => Promise.reject(new Error("taskmanager_task_todo_delete: you need Can move on this backlog"))),
    });
    show(client);
    await screen.findByText("Piece 1 title");
    await choose(4, "Set status");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("you need Can move on this backlog");
    await choose(3, "Delete");
    await vi.waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
    expect(within(rowOf("Piece 3 title")).getByRole("alert")).toHaveTextContent("you need Can move on this backlog");
    expect(client.list).toHaveBeenCalledTimes(1);
  });
});

describe("the Add a piece line", () => {
  it("is not there while the list is loading", async () => {
    show(clientOf(() => new Promise(() => {})));
    expect(screen.queryByRole("button", { name: /Add a piece/ })).toBeNull();
  });

  it("is there on an empty list", async () => {
    show(clientOf(async () => []));
    expect(await screen.findByRole("button", { name: "+ Add a piece" })).toBeInTheDocument();
    expect(screen.queryByText(/of 0/)).toBeNull();
  });

  it("opens a field for the title, keeps Add off until something is typed and adds the piece to this issue", async () => {
    const client = clientOf(async () => pieces);
    show(client);
    await userEvent.click(await screen.findByRole("button", { name: "+ Add a piece" }));
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox", { name: "Title of the new piece" }), "  Check the links  ");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(client.add).toHaveBeenCalledWith("i1", "Check the links");
    await vi.waitFor(() => expect(client.list).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("button", { name: "+ Add a piece" })).toBeInTheDocument();
  });

  it("closes on Cancel without adding", async () => {
    const client = clientOf(async () => pieces);
    show(client);
    await userEvent.click(await screen.findByRole("button", { name: "+ Add a piece" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(client.add).not.toHaveBeenCalled();
  });

  it("shows the API's message and keeps what was typed when the add is refused", async () => {
    const client = clientOf(async () => pieces, { add: vi.fn(async () => Promise.reject(new Error("taskmanager_task_todo_create: you need Can move on this backlog"))) });
    show(client);
    await userEvent.click(await screen.findByRole("button", { name: "+ Add a piece" }));
    await userEvent.type(screen.getByRole("textbox"), "Check the links");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("you need Can move on this backlog");
    expect(screen.getByRole("textbox")).toHaveValue("Check the links");
    expect(client.list).toHaveBeenCalledTimes(1);
  });
});

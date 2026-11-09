import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { AddBacklogScreen } from "./AddBacklogScreen";
import { EditBacklogScreen } from "./EditBacklogScreen";
import { savedStep } from "./stepsDraft";
import { ManageRefused, type BacklogManageClient } from "./types";

beforeEach(() => openAgency("hub-steward-swe"));

afterEach(() => forgetOpenAgency());

const software = {
  id: "software",
  name: "Software",
  steps: [savedStep("to-do", "To do", 5), savedStep("doing", "Doing", 1), savedStep("review", "Review", 0), savedStep("done", "Done", 0)],
};

const fake = (over: Partial<BacklogManageClient> = {}): BacklogManageClient => ({
  mayManage: vi.fn().mockResolvedValue(true),
  read: vi.fn().mockResolvedValue(software),
  create: vi.fn().mockResolvedValue("support"),
  save: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const base = "/a/hub-steward-swe/backlogs";

const show = (path: string, client: BacklogManageClient) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={`${base}/new`} element={<AddBacklogScreen client={client} />} />
        <Route path={`${base}/:backlogId/edit`} element={<EditBacklogScreen client={client} />} />
        <Route path={base} element={<p>Backlogs screen</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("add a backlog", () => {
  it("creates a backlog from a name and steps in order, then goes back to Backlogs", async () => {
    const client = fake();
    show(`${base}/new`, client);
    await userEvent.type(await screen.findByLabelText("Name"), "Support");
    for (const step of ["New", "Answering", "Closed"]) {
      await userEvent.type(screen.getByLabelText("New step"), step);
      await userEvent.click(screen.getByRole("button", { name: "Add a step" }));
    }
    await userEvent.click(screen.getByRole("button", { name: "Move Closed up" }));
    await userEvent.click(screen.getByRole("button", { name: "Create the backlog" }));
    await waitFor(() => expect(client.create).toHaveBeenCalledWith("Support", ["New", "Closed", "Answering"]));
    expect(await screen.findByText("Backlogs screen")).toBeInTheDocument();
  });

  it("says what is missing and creates nothing", async () => {
    const client = fake();
    show(`${base}/new`, client);
    await userEvent.click(await screen.findByRole("button", { name: "Create the backlog" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Give the backlog a name.");
    expect(client.create).not.toHaveBeenCalled();
  });

  it("shows the tool's refusal and stays on the screen", async () => {
    const client = fake({ create: vi.fn().mockRejectedValue(new ManageRefused("A backlog called Support already exists.")) });
    show(`${base}/new`, client);
    await userEvent.type(await screen.findByLabelText("Name"), "Support");
    await userEvent.type(screen.getByLabelText("New step"), "New");
    await userEvent.click(screen.getByRole("button", { name: "Add a step" }));
    await userEvent.click(screen.getByRole("button", { name: "Create the backlog" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A backlog called Support already exists.");
  });

  it("shows only a card to a role without the permission", async () => {
    show(`${base}/new`, fake({ mayManage: vi.fn().mockResolvedValue(false) }));
    expect(await screen.findByText("Your role cannot change backlogs.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create the backlog" })).toBeNull();
  });
});

describe("edit a backlog", () => {
  it("shows the steps with how many issues each holds and turns off removing a step that holds issues", async () => {
    show(`${base}/software/edit`, fake());
    expect(await screen.findByText("Edit Software")).toBeInTheDocument();
    expect(screen.getByText("5 issues")).toBeInTheDocument();
    expect(screen.getByText("1 issue")).toBeInTheDocument();
    expect(screen.getAllByText("No issues")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Remove To do" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove Doing" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove Review" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move To do up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete the backlog" })).toBeDisabled();
  });

  it("saves a rename, a removed step and a new order", async () => {
    const client = fake();
    show(`${base}/software/edit`, client);
    const name = await screen.findByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Engineering");
    await userEvent.click(screen.getByRole("button", { name: "Remove Review" }));
    await userEvent.click(screen.getByRole("button", { name: "Move Done up" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.save).toHaveBeenCalled());
    const [id, savedName, steps] = (client.save as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(id).toBe("software");
    expect(savedName).toBe("Engineering");
    expect(steps.map((step: { name: string }) => step.name)).toEqual(["To do", "Done", "Doing"]);
    expect(await screen.findByText("Backlogs screen")).toBeInTheDocument();
  });

  it("deletes an empty backlog", async () => {
    const empty = { id: "support", name: "Support", steps: [savedStep("new", "New", 0)] };
    const client = fake({ read: vi.fn().mockResolvedValue(empty) });
    show(`${base}/support/edit`, client);
    await userEvent.click(await screen.findByRole("button", { name: "Delete the backlog" }));
    await waitFor(() => expect(client.remove).toHaveBeenCalledWith("support"));
  });

  it("shows a refused removal in words and keeps the screen", async () => {
    const client = fake({ save: vi.fn().mockRejectedValue(new ManageRefused("Review holds 2 issues, so it cannot be removed.")) });
    show(`${base}/software/edit`, client);
    await userEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Review holds 2 issues, so it cannot be removed.");
    expect(screen.queryByText("Backlogs screen")).toBeNull();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { BacklogsPage } from "../backlogs/BacklogsPage";
import { EditSmartBacklogScreen } from "./SmartScreens";
import type { FieldChoices, SmartBacklogClient } from "./types";

beforeEach(() => openAgency("hub-steward-swe"));

afterEach(() => forgetOpenAgency());

const choices: FieldChoices = { tag: ["Docs"], mark: ["Ready", "Blocked"], backlog: ["Software"], step: ["To do"], priority: ["high"] };

const clientFor = (may: boolean, remove = vi.fn().mockResolvedValue(undefined)) => {
  const client: SmartBacklogClient = {
    choices: async () => choices,
    count: async () => 2,
    create: async () => "s1",
    read: async () => ({ id: "s1", name: "walk-09 smart", set: { match: "all", rules: [{ field: "mark", operator: "is", value: "Ready" }] }, issues: 2 }),
    update: async () => undefined,
    mayManage: async () => may,
    remove,
  };
  return { client, remove };
};

const open = (client: SmartBacklogClient) =>
  render(
    <MemoryRouter initialEntries={["/a/hub-steward-swe/backlogs/s1/rules"]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/:backlogId/rules" element={<EditSmartBacklogScreen client={client} />} />
        <Route
          path="/a/:agencyId/backlogs"
          element={<BacklogsPage client={{ backlogs: async () => [], issues: async () => [] } as never} manage={{ mayManage: async () => true } as never} />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe("deleting a smart backlog from its Edit rules screen", () => {
  it("offers the button to a person who may manage backlogs", async () => {
    open(clientFor(true).client);
    expect(await screen.findByRole("button", { name: "Delete this smart backlog" })).toBeInTheDocument();
  });

  it("offers nothing to a person who may not", async () => {
    open(clientFor(false).client);
    await screen.findByRole("button", { name: "Save" });
    expect(screen.queryByRole("button", { name: "Delete this smart backlog" })).toBeNull();
  });

  it("asks first, and Cancel sends nothing", async () => {
    const { client, remove } = clientFor(true);
    open(client);
    await userEvent.click(await screen.findByRole("button", { name: "Delete this smart backlog" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Delete walk-09 smart?");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete this smart backlog" })).toBeInTheDocument();
  });

  it("deletes once on Delete and returns to the Backlogs screen with one line", async () => {
    const { client, remove } = clientFor(true);
    open(client);
    await userEvent.click(await screen.findByRole("button", { name: "Delete this smart backlog" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Backlogs" })).toBeInTheDocument());
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith("s1");
    expect(screen.getByText("Deleted walk-09 smart")).toBeInTheDocument();
  });

  it("says so and stays when the hub refuses", async () => {
    const { client } = clientFor(true, vi.fn().mockRejectedValue(new Error("no")));
    open(client);
    await userEvent.click(await screen.findByRole("button", { name: "Delete this smart backlog" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("The smart backlog could not be deleted. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});

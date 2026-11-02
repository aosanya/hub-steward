import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../agency/open";
import type { GroupsClient, JoinableGroup } from "../../groups/api";
import { routes } from "../../routes";
import { JoinPage } from "./JoinPage";

const farmers: JoinableGroup = { id: "g1", name: "Siaya farmers", code: "G-S7F-4KM-2RX", approvalNeeded: false };

const fake = (over: Partial<GroupsClient> = {}): GroupsClient => ({
  listJoinableGroups: async () => [farmers],
  findGroupByCode: async () => farmers,
  joinGroup: async (groupId) => ({ groupId, state: "joined" }),
  listMyJoinRequests: async () => [],
  listMyGroups: async () => [],
  ...over,
});

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const show = (client: GroupsClient) =>
  render(
    <MemoryRouter initialEntries={[routes.join.path()]}>
      <Routes>
        <Route path={routes.join.pattern} element={<JoinPage client={client} />} />
      </Routes>
    </MemoryRouter>,
  );

const refused = async () => {
  throw new Error("down");
};

describe("join group when a call fails or repeats a group", () => {
  it("draws the alert and not No groups are open when the group list cannot be read", async () => {
    show(fake({ listJoinableGroups: refused }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("No groups are open to join yet.")).toBeNull();
  });

  it("clears the alert when the next Find answers", async () => {
    let calls = 0;
    show(
      fake({
        findGroupByCode: async () => {
          calls += 1;
          if (calls === 1) throw new Error("down");
          return farmers;
        },
      }),
    );
    await screen.findAllByText("Siaya farmers");
    await userEvent.type(screen.getByLabelText("Have a group code?"), farmers.code);
    await userEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Find" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("clears the alert when the next Join answers", async () => {
    let calls = 0;
    show(
      fake({
        joinGroup: async (groupId) => {
          calls += 1;
          if (calls === 1) throw new Error("down");
          return { groupId, state: "joined" };
        },
      }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Join" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("draws a group the member is in once when its code is found", async () => {
    show(fake({ listMyGroups: async () => [{ id: "g1", name: "Siaya farmers" }] }));
    await screen.findByText("You are in");
    await userEvent.type(screen.getByLabelText("Have a group code?"), farmers.code);
    await userEvent.click(screen.getByRole("button", { name: "Find" }));
    await waitFor(() => expect(screen.getAllByText("Siaya farmers")).toHaveLength(1));
  });

  it("draws a group once after it is joined from a found code", async () => {
    show(fake({ listJoinableGroups: async () => [] }));
    await userEvent.type(await screen.findByLabelText("Have a group code?"), farmers.code);
    await userEvent.click(screen.getByRole("button", { name: "Find" }));
    await userEvent.click(await screen.findByRole("button", { name: "Join" }));
    await waitFor(() => expect(screen.getAllByText("Siaya farmers")).toHaveLength(1));
  });
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { savedStep } from "../backlogManage/stepsDraft";
import type { BacklogManageClient } from "../backlogManage/types";
import { groupOf, readingOf } from "./api";
import { BacklogAccessScreen } from "./BacklogAccessScreen";
import { rowsOf } from "./levels";
import { AccessRefused, type AccessReading, type BacklogAccessClient } from "./types";

beforeEach(() => openAgency("hub-steward-swe"));

afterEach(() => forgetOpenAgency());

const reading: AccessReading = {
  ownerGroup: "po",
  grants: [
    { groupId: "core", level: "move" },
    { groupId: "contrib", level: "see" },
  ],
};

const groups = [
  { id: "po", name: "Product owner" },
  { id: "core", name: "Core team" },
  { id: "contrib", name: "Contributors" },
  { id: "guests", name: "Guests" },
];

const manageFake = (allowed = true): BacklogManageClient => ({
  mayManage: vi.fn().mockResolvedValue(allowed),
  read: vi.fn().mockResolvedValue({ id: "software", name: "Software", steps: [savedStep("to-do", "To do", 0)] }),
  create: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
});

const accessFake = (over: Partial<BacklogAccessClient> = {}): BacklogAccessClient => ({
  read: vi.fn().mockResolvedValue(reading),
  groups: vi.fn().mockResolvedValue(groups),
  set: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const base = "/a/hub-steward-swe/backlogs";

const show = (client: BacklogAccessClient, manage = manageFake()) =>
  render(
    <MemoryRouter initialEntries={[`${base}/software/access`]}>
      <Routes>
        <Route path={`${base}/:backlogId/access`} element={<BacklogAccessScreen client={client} manage={manage} />} />
        <Route path={`${base}/:backlogId/page`} element={<p>Backlog page</p>} />
      </Routes>
    </MemoryRouter>,
  );

const cardOf = async (name: string) => (await screen.findByText(name)).closest("section") as HTMLElement;

describe("access to a backlog", () => {
  it("lists each group with its level and keeps the Product owner group fixed at Can move", async () => {
    show(accessFake());
    expect(await screen.findByRole("heading", { name: "Access to Software" })).toBeInTheDocument();
    expect(within(await cardOf("Product owner")).getByText("Can move")).toBeInTheDocument();
    expect(within(await cardOf("Product owner")).queryByRole("button")).toBeNull();
    expect(within(await cardOf("Contributors")).getByRole("button", { name: "Can see" })).toHaveAttribute("aria-pressed", "true");
    expect(within(await cardOf("Core team")).getByRole("button", { name: "Can move" })).toHaveAttribute("aria-pressed", "true");
  });

  it("saves a level as soon as it is chosen", async () => {
    const client = accessFake();
    show(client);
    await userEvent.click(within(await cardOf("Contributors")).getByRole("button", { name: "Can move" }));
    await waitFor(() => expect(client.set).toHaveBeenCalledWith("software", "contrib", "move"));
    expect(within(await cardOf("Contributors")).getByRole("button", { name: "Can move" })).toHaveAttribute("aria-pressed", "true");
  });

  it("takes access away with No access and offers the group again under Add a group", async () => {
    const client = accessFake();
    show(client);
    await userEvent.click(within(await cardOf("Contributors")).getByRole("button", { name: "No access" }));
    await waitFor(() => expect(client.remove).toHaveBeenCalledWith("software", "contrib"));
    await waitFor(() => expect(screen.queryByText("Contributors")).toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "Add a group" }));
    expect(screen.getByRole("button", { name: "Contributors" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guests" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Core team" })).toBeNull();
  });

  it("adds a group that has none yet at Can see", async () => {
    const client = accessFake();
    show(client);
    await userEvent.click(await screen.findByRole("button", { name: "Add a group" }));
    await userEvent.click(screen.getByText("Guests"));
    await waitFor(() => expect(client.set).toHaveBeenCalledWith("software", "guests", "see"));
    expect(within(await cardOf("Guests")).getByRole("button", { name: "Can see" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Add a group" })).toBeInTheDocument();
  });

  it("says when every group already has access", async () => {
    show(accessFake({ groups: vi.fn().mockResolvedValue(groups.slice(0, 3)) }));
    await userEvent.click(await screen.findByRole("button", { name: "Add a group" }));
    expect(screen.getByText("Every group already has access.")).toBeInTheDocument();
  });

  it("shows the tool's refusal and keeps the level that was saved", async () => {
    const client = accessFake({ set: vi.fn().mockRejectedValue(new AccessRefused("You cannot change this group.")) });
    show(client);
    await userEvent.click(within(await cardOf("Contributors")).getByRole("button", { name: "Can move" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You cannot change this group.");
    expect(within(await cardOf("Contributors")).getByRole("button", { name: "Can see" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows no controls to a role without the manage permission", async () => {
    show(accessFake(), manageFake(false));
    expect(await screen.findByText("Your role cannot change who has access to backlogs.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a group" })).toBeNull();
  });

  it("says when the access could not be loaded", async () => {
    show(accessFake({ read: vi.fn().mockRejectedValue(new Error("down")) }));
    expect(await screen.findByText("The access could not be loaded.")).toBeInTheDocument();
  });

  it("goes back to the backlog's page", async () => {
    show(accessFake());
    await userEvent.click(await screen.findByRole("button", { name: /back/i }));
    expect(await screen.findByText("Backlog page")).toBeInTheDocument();
  });
});

describe("reading the tool replies", () => {
  it("reads the owner group and the grants from owner_group and groups", () => {
    expect(readingOf({ backlog_id: "software", owner_group: "po", groups: [{ group_id: "core", level: "move" }, { group_id: "contrib", level: "see" }, { level: "see" }] })).toEqual({
      ownerGroup: "po",
      grants: [
        { groupId: "core", level: "move" },
        { groupId: "contrib", level: "see" },
      ],
    });
  });

  it("reads an empty reply as no owner group and no grants", () => {
    expect(readingOf({})).toEqual({ ownerGroup: "", grants: [] });
  });

  it("reads a group from id and name", () => {
    expect(groupOf({ id: "g1", name: "Core team" })).toEqual({ id: "g1", name: "Core team" });
  });
});

describe("joining grants to group names", () => {
  it("puts the owner group first, once, at Can move, and falls back to the id for an unknown group", () => {
    const rows = rowsOf({ ownerGroup: "po", grants: [{ groupId: "po", level: "see" }, { groupId: "x9", level: "see" }] }, groups);
    expect(rows).toEqual([
      { groupId: "po", name: "Product owner", level: "move", fixed: true },
      { groupId: "x9", name: "x9", level: "see", fixed: false },
    ]);
  });
});

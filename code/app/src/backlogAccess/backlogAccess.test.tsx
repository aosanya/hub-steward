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
    { groupId: "core", level: "move", roleTooSmall: false, noRole: false, roles: [] },
    { groupId: "contrib", level: "see", roleTooSmall: false, noRole: false, roles: [] },
  ],
};

const groups = [
  { id: "po", name: "Product owner", hierarchyId: "h1" },
  { id: "core", name: "Core team", hierarchyId: "h1" },
  { id: "contrib", name: "Contributors", hierarchyId: "h1" },
  { id: "guests", name: "Guests", hierarchyId: "h1" },
  { id: "other", name: "Other hierarchy", hierarchyId: "h2" },
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
  setOwnerGroup: vi.fn().mockResolvedValue(undefined),
  isSmart: vi.fn().mockResolvedValue(false),
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
  it("lists each group with its level and keeps the Product owner group fixed at Can edit", async () => {
    show(accessFake());
    expect(await screen.findByRole("heading", { name: "Access to Software" })).toBeInTheDocument();
    expect(within(await cardOf("Product owner")).getByText("Can edit")).toBeInTheDocument();
    expect(within(await cardOf("Product owner")).queryByRole("button")).toBeNull();
    expect(within(await cardOf("Contributors")).getByRole("button", { name: "Can see" })).toHaveAttribute("aria-pressed", "true");
    expect(within(await cardOf("Core team")).getByRole("button", { name: "Can move" })).toHaveAttribute("aria-pressed", "true");
  });

  it("offers a smart backlog only Can see and Can edit, since it has nothing to move", async () => {
    show(accessFake({ read: vi.fn().mockResolvedValue({ ownerGroup: "po", grants: [{ groupId: "contrib", level: "see", roleTooSmall: false, noRole: false, roles: [] }] }), isSmart: vi.fn().mockResolvedValue(true) }));
    const card = await cardOf("Contributors");
    expect(within(card).getByRole("button", { name: "Can see" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Can edit" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Can move" })).toBeNull();
  });

  it("keeps all three levels on a backlog with steps", async () => {
    show(accessFake());
    const card = await cardOf("Contributors");
    expect(within(card).getByRole("button", { name: "Can move" })).toBeInTheDocument();
  });

  it("saves a level as soon as it is chosen", async () => {
    const client = accessFake();
    show(client);
    await userEvent.click(within(await cardOf("Contributors")).getByRole("button", { name: "Can move" }));
    await waitFor(() => expect(client.set).toHaveBeenCalledWith("software", "contrib", "move"));
    expect(within(await cardOf("Contributors")).getByRole("button", { name: "Can move" })).toHaveAttribute("aria-pressed", "true");
  });

  it("takes access away with the cross and offers the group again under Add a group", async () => {
    const client = accessFake();
    show(client);
    await userEvent.click(within(await cardOf("Contributors")).getByRole("button", { name: "Take away access from Contributors" }));
    await userEvent.click(await screen.findByRole("button", { name: "Take away" }));
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
        { groupId: "core", level: "move", roleTooSmall: false, noRole: false, roles: [] },
        { groupId: "contrib", level: "see", roleTooSmall: false, noRole: false, roles: [] },
      ],
    });
  });

  it("reads an empty reply as no owner group and no grants", () => {
    expect(readingOf({})).toEqual({ ownerGroup: "", grants: [] });
  });

  it("reads a group from id and name", () => {
    expect(groupOf({ id: "g1", name: "Core team", hierarchy_id: "h1" })).toEqual({ id: "g1", name: "Core team", hierarchyId: "h1" });
  });
});

describe("joining grants to group names", () => {
  it("puts the owner group first, once, at Can edit, and calls an unknown group a group that no longer exists", () => {
    const rows = rowsOf({ ownerGroup: "po", grants: [{ groupId: "po", level: "see", roleTooSmall: false, noRole: false, roles: [] }, { groupId: "x9", level: "see", roleTooSmall: false, noRole: false, roles: [] }] }, groups);
    expect(rows).toEqual([
      { groupId: "po", name: "Product owner", level: "edit", fixed: true, roleName: "", roleTooSmall: false },
      { groupId: "x9", name: "A group that no longer exists", level: "see", fixed: false, roleName: "", roleTooSmall: false },
    ]);
  });
});

describe("fixes from the review", () => {
  it("does not load the access for a role that may not manage, so only one message shows", async () => {
    const client = accessFake({ read: vi.fn().mockRejectedValue(new Error("down")) });
    show(client, manageFake(false));
    expect(await screen.findByText("Your role cannot change who has access to backlogs.")).toBeInTheDocument();
    expect(screen.queryByText("The access could not be loaded.")).toBeNull();
    expect(client.read).not.toHaveBeenCalled();
  });

  it("names each group's switch after the group", async () => {
    show(accessFake());
    expect(await screen.findByRole("group", { name: "Access for Contributors" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Access for Core team" })).toBeInTheDocument();
  });

  it("disables the switches while a save is in flight", async () => {
    let finish: () => void = () => undefined;
    const client = accessFake({ set: vi.fn().mockReturnValue(new Promise<void>((resolve) => (finish = resolve))) });
    show(client);
    await userEvent.click(within(await cardOf("Contributors")).getByRole("button", { name: "Can move" }));
    await waitFor(() => expect(within(screen.getByRole("group", { name: "Access for Core team" })).getByRole("button", { name: "Can see" })).toBeDisabled());
    finish();
    await waitFor(() => expect(within(screen.getByRole("group", { name: "Access for Core team" })).getByRole("button", { name: "Can see" })).toBeEnabled());
  });

  it("calls a group that is no longer in the list a group that no longer exists, never its id", async () => {
    show(accessFake({ read: vi.fn().mockResolvedValue({ ownerGroup: "po", grants: [{ groupId: "x9", level: "see", roleTooSmall: false, noRole: false, roles: [] }] }) }));
    expect(await screen.findByText("A group that no longer exists")).toBeInTheDocument();
    expect(screen.queryByText("x9")).toBeNull();
  });

  it("offers only groups of the Product owner group's hierarchy under Add a group", async () => {
    show(accessFake());
    await userEvent.click(await screen.findByRole("button", { name: "Add a group" }));
    expect(screen.getByRole("button", { name: "Guests" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Other hierarchy" })).toBeNull();
  });

  it("asks before taking a group away and keeps it when cancelled", async () => {
    const client = accessFake();
    show(client);
    await userEvent.click(within(await cardOf("Contributors")).getByRole("button", { name: "Take away access from Contributors" }));
    expect(await screen.findByText("Take away Contributors?")).toBeInTheDocument();
    expect(client.remove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Take away Contributors?")).toBeNull();
    expect(client.remove).not.toHaveBeenCalled();
    expect(await cardOf("Contributors")).toBeInTheDocument();
  });

  it("reads the access again after a refused save so the list shows what the hub holds", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(reading)
      .mockResolvedValue({ ownerGroup: "po", grants: [{ groupId: "core", level: "move", roleTooSmall: false, noRole: false, roles: [] }, { groupId: "contrib", level: "move", roleTooSmall: false, noRole: false, roles: [] }] });
    const client = accessFake({ read, set: vi.fn().mockRejectedValue(new AccessRefused("Someone else changed this.")) });
    show(client);
    await userEvent.click(within(await cardOf("Contributors")).getByRole("button", { name: "Can move" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Someone else changed this.");
    await waitFor(() => expect(within(screen.getByRole("group", { name: "Access for Contributors" })).getByRole("button", { name: "Can move" })).toHaveAttribute("aria-pressed", "true"));
  });
});

describe("a hub with no Product owner group", () => {
  const noOwner = (over: Partial<BacklogAccessClient> = {}) => accessFake({ read: vi.fn().mockResolvedValue({ ownerGroup: "", grants: [] }), ...over });

  it("says nobody is restricted, offers the groups to choose from and hides Add a group", async () => {
    show(noOwner());
    expect(await screen.findByText("Nobody is restricted yet: choose the Product owner group first.")).toBeInTheDocument();
    expect(screen.getByText("Core team")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a group" })).toBeNull();
  });

  it("names the chosen group as the Product owner group and then shows it fixed at Can edit", async () => {
    const client = noOwner();
    show(client);
    await userEvent.click(await screen.findByText("Product owner"));
    await waitFor(() => expect(client.setOwnerGroup).toHaveBeenCalledWith("po"));
    await waitFor(() => expect(screen.queryByText("Nobody is restricted yet: choose the Product owner group first.")).toBeNull());
    expect(within(await cardOf("Product owner")).getByText("Can edit")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a group" })).toBeInTheDocument();
  });

  it("shows the hub's refusal in words when naming the group fails", async () => {
    show(noOwner({ setOwnerGroup: vi.fn().mockRejectedValue(new AccessRefused("That group does not exist.")) }));
    await userEvent.click(await screen.findByText("Core team"));
    expect(await screen.findByRole("alert")).toHaveTextContent("That group does not exist.");
    expect(screen.getByText("Nobody is restricted yet: choose the Product owner group first.")).toBeInTheDocument();
  });
});

describe("the role of each group", () => {
  const grant = (groupId: string, level: "see" | "move" | "edit", roles: string[], roleTooSmall = false, noRole = false) => ({ groupId, level, roles, roleTooSmall, noRole });

  const readOf = (...grants: ReturnType<typeof grant>[]): AccessReading => ({ ownerGroup: "po", grants });

  it("shows 'Uses the Backlogs as' with the role's name, and 'no role yet' for a group without one", async () => {
    show(accessFake({ read: vi.fn().mockResolvedValue(readOf(grant("core", "move", ["backlog_worker"]), grant("contrib", "see", []))) }));
    expect(within(await cardOf("Core team")).getByText("Uses the Backlogs as: Backlog worker")).toBeInTheDocument();
    expect(within(await cardOf("Contributors")).getByText("Uses the Backlogs as: no role yet")).toBeInTheDocument();
  });

  it("names every role a group holds and shows a role the screen does not know by its code", async () => {
    show(accessFake({ read: vi.fn().mockResolvedValue(readOf(grant("core", "see", ["backlog_member", "triage"]))) }));
    expect(within(await cardOf("Core team")).getByText("Uses the Backlogs as: Backlog member, triage")).toBeInTheDocument();
  });

  it("draws no role line on the fixed Product owner row", async () => {
    show(accessFake({ read: vi.fn().mockResolvedValue(readOf(grant("core", "see", ["backlog_member"]))) }));
    expect(within(await cardOf("Product owner")).queryByText(/Uses the Backlogs as/)).toBeNull();
  });

  it("warns, once, when a group can move issues but its role is too small", async () => {
    show(accessFake({ read: vi.fn().mockResolvedValue(readOf(grant("contrib", "move", ["backlog_member"], true), grant("core", "move", ["backlog_worker"]))) }));
    expect(within(await cardOf("Contributors")).getByText("This group's role is too small to move issues")).toBeInTheDocument();
    expect(screen.getAllByText("This group's role is too small to move issues")).toHaveLength(1);
  });

  it("shows the role the hub gave in the same step as the access, after the change", async () => {
    const after = readOf(grant("core", "move", ["backlog_worker"]), grant("contrib", "see", ["backlog_member"]), grant("guests", "see", ["backlog_member"]));
    const client = accessFake({ read: vi.fn().mockResolvedValueOnce(readOf(grant("core", "move", ["backlog_worker"]), grant("contrib", "see", ["backlog_member"]))).mockResolvedValue(after) });
    show(client);
    await userEvent.click(await screen.findByRole("button", { name: "Add a group" }));
    await userEvent.click(screen.getByRole("button", { name: "Guests" }));
    await waitFor(() => expect(client.set).toHaveBeenCalledWith("software", "guests", "see"));
    expect(await within(await cardOf("Guests")).findByText("Uses the Backlogs as: Backlog member")).toBeInTheDocument();
  });

  it("clears the warning once the hub reports the role is big enough", async () => {
    const small = readOf(grant("contrib", "move", ["backlog_member"], true));
    const fixed = readOf(grant("contrib", "move", ["backlog_worker"]));
    const client = accessFake({ read: vi.fn().mockResolvedValueOnce(small).mockResolvedValue(fixed) });
    show(client);
    expect(await screen.findByText("This group's role is too small to move issues")).toBeInTheDocument();
    await userEvent.click(within(await cardOf("Contributors")).getByRole("button", { name: "Can see" }));
    await userEvent.click(within(await cardOf("Contributors")).getByRole("button", { name: "Can move" }));
    await waitFor(() => expect(screen.queryByText("This group's role is too small to move issues")).toBeNull());
  });

  it("says 'no role yet' for a group whose only role cannot read the Backlogs, whatever the role's code", async () => {
    show(accessFake({ read: vi.fn().mockResolvedValue(readOf(grant("core", "see", ["R-9"], false, true))) }));
    expect(within(await cardOf("Core team")).getByText("Uses the Backlogs as: no role yet")).toBeInTheDocument();
  });

  it("reads the roles and the too-small flag of a group from the access list", () => {
    expect(readingOf({ owner_group: "po", groups: [{ group_id: "g1", level: "move", roles: ["backlog_member", ""], role_too_small: true }, { group_id: "g2", level: "see", no_role: true }] })).toEqual({
      ownerGroup: "po",
      grants: [
        { groupId: "g1", level: "move", roleTooSmall: true, noRole: false, roles: ["backlog_member"] },
        { groupId: "g2", level: "see", roleTooSmall: false, noRole: true, roles: [] },
      ],
    });
  });
});

describe("the Can edit level", () => {
  it("offers Can see, Can move and Can edit and no No access segment", async () => {
    show(accessFake());
    const group = await screen.findByRole("group", { name: "Access for Contributors" });
    expect(within(group).getAllByRole("button").map((one) => one.textContent)).toEqual(["Can see", "Can move", "Can edit"]);
  });

  it("saves Can edit as soon as it is chosen", async () => {
    const client = accessFake();
    show(client);
    await userEvent.click(within(await cardOf("Core team")).getByRole("button", { name: "Can edit" }));
    await waitFor(() => expect(client.set).toHaveBeenCalledWith("software", "core", "edit"));
    expect(within(await cardOf("Core team")).getByRole("button", { name: "Can edit" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a group the hub holds at Can edit and names the Backlog manager role", async () => {
    show(accessFake({ read: vi.fn().mockResolvedValue({ ownerGroup: "po", grants: [{ groupId: "core", level: "edit", roleTooSmall: false, noRole: false, roles: ["backlog_manager"] }] }) }));
    expect(within(await cardOf("Core team")).getByRole("button", { name: "Can edit" })).toHaveAttribute("aria-pressed", "true");
    expect(within(await cardOf("Core team")).getByText("Uses the Backlogs as: Backlog manager")).toBeInTheDocument();
  });

  it("reads the edit level from the access list", () => {
    expect(readingOf({ owner_group: "po", groups: [{ group_id: "g1", level: "edit" }] }).grants[0].level).toBe("edit");
  });

  it("gives the fixed Product owner group no cross", async () => {
    show(accessFake());
    expect(within(await cardOf("Product owner")).queryByRole("button", { name: /Take away access/ })).toBeNull();
  });
});

import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Row = Record<string, unknown>;

const personName = "Sample Resident A";
const personId = "p1";
const streetGroup = "Sample Street Group";
const wardGroup = "Sample Ward Group";
const permitForm = "Sample Stall Permit";
const wishTitle = "Sample pothole wish";
const wishTopic = "Roads";
const wishAddress = "Sample Lane 4";

const assignGroupPermission = "group.manage";
const fileApplicationPermission = "application.file";
const raiseForPermission = "board.manage";

const widths = [
  { name: "a phone page", wide: false, pane: ".mw-detail" },
  { name: "the computer pane", wide: true, pane: ".wf .wf-main .wf-content" },
];

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let memberships: string[];
let applications: Row[];
let raised: Row[];

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "forms" }] };
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "actor_list_actors") return { items: [{ id: personId, display_name: personName, status: "active" }] };
  if (name === "actor_get_actor") return { id: personId, display_name: personName, status: "active" };
  if (name === "actor_list_groups_for_actor") return { items: memberships.map((group_id) => ({ group_id })) };
  if (name === "actor_list_groups")
    return {
      items: [
        { id: "g1", name: streetGroup },
        { id: "g2", name: wardGroup },
      ],
    };
  if (name === "actor_get_group") return { item: { id: given.group_id, name: given.group_id === "g1" ? streetGroup : wardGroup, join_mode: "open" } };
  if (name === "actor_assign_group") {
    memberships = [...memberships, String(given.group_id)];
    return {};
  }
  if (name === "forms_submission_list_of_person") return { items: applications };
  if (name === "forms_form_list") return { items: [{ id: "f1", title: permitForm, status: "open" }] };
  if (name === "forms_submission_file") {
    applications = [...applications, { id: "s9", form_id: given.form_id, form_title: permitForm, member_id: given.member_id, submitted_at: "2026-11-18T09:30:00Z" }];
    return {};
  }
  if (name === "forms_catalog_raised_item_list_of_person") return { items: raised };
  if (name === "forms_catalog_raised_item_file") {
    raised = [...raised, { id: "w9", title: given.title, status: "open", created_at: "2026-11-18T09:30:00Z" }];
    return {};
  }
  return { items: [] };
};

beforeEach(() => {
  openAgency("town");
  permissions = ["member.view", assignGroupPermission, fileApplicationPermission, raiseForPermission];
  memberships = [];
  applications = [];
  raised = [];
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

function Here() {
  const here = useLocation();
  return <output data-testid="here">{`${here.pathname}${here.search}`}</output>;
}

const callsTo = (tool: string) => called.mock.calls.filter((call) => call[1] === tool).map((call) => call[2]);

const openPerson = async (wide: boolean) => {
  setWide(wide);
  const path = items.find((item) => item.title === "All People")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Here />
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  if (!wide) await userEvent.click(await screen.findByRole("button", { name: new RegExp(personName) }));
  await screen.findByRole("heading", { name: "Groups" });
};

const cardOf = async (words: RegExp) => (await screen.findByText(words)).closest(".card") as HTMLElement;

const rolesAnswered = async () => waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

describe.each(widths)("the empty Groups card on $name", (view) => {
  it("carries Add to a group, which lists the groups, registers the person in the chosen one and then lists it", async () => {
    await openPerson(view.wide);

    const card = await cardOf(/Not in any group yet/);
    await userEvent.click(await within(card).findByRole("button", { name: "Add to a group" }));
    const picker = await screen.findByRole("dialog", { name: "Add to a group" });
    expect(within(picker).getByRole("button", { name: new RegExp(streetGroup) })).toBeTruthy();
    await userEvent.click(within(picker).getByRole("button", { name: new RegExp(wardGroup) }));

    await waitFor(() => expect(callsTo("actor_assign_group")).toEqual([{ actor_id: personId, group_id: "g2" }]));
    const pane = document.querySelector(view.pane) as HTMLElement;
    expect(await within(pane).findByText(wardGroup)).toBeTruthy();
    expect(within(pane).queryByText(/Not in any group yet/)).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the card without Add to a group to a reader who lacks the permission, even one who holds the other two acts", async () => {
    permissions = ["member.view", fileApplicationPermission, raiseForPermission];

    await openPerson(view.wide);

    await cardOf(/Not in any group yet/);
    await rolesAnswered();
    expect(screen.queryByRole("button", { name: "Add to a group" })).toBeNull();
    expect(callsTo("actor_assign_group")).toEqual([]);
  });
});

describe.each(widths)("the empty Applications card on $name", (view) => {
  it("carries Start an application, which lists the forms, files the chosen one for the person by phone and then lists it", async () => {
    await openPerson(view.wide);

    const card = await cardOf(/No applications yet/);
    await userEvent.click(await within(card).findByRole("button", { name: "Start an application" }));
    const picker = await screen.findByRole("dialog", { name: "Start an application" });
    await userEvent.click(await within(picker).findByRole("button", { name: new RegExp(permitForm) }));

    await waitFor(() => expect(callsTo("forms_submission_file")).toEqual([expect.objectContaining({ form_id: "f1", member_id: personId, channel: "phone", answers: expect.anything() })]));
    const pane = document.querySelector(view.pane) as HTMLElement;
    expect(await within(pane).findByText(permitForm)).toBeTruthy();
    expect(within(pane).queryByText(/No applications yet/)).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reads the forms only when Start an application is pressed", async () => {
    await openPerson(view.wide);

    const card = await cardOf(/No applications yet/);
    expect(callsTo("forms_form_list")).toEqual([]);
    await userEvent.click(await within(card).findByRole("button", { name: "Start an application" }));

    await waitFor(() => expect(callsTo("forms_form_list")).toHaveLength(1));
  });

  it("shows the card without Start an application to a reader who lacks application.file, even one who holds the other two acts", async () => {
    permissions = ["member.view", assignGroupPermission, raiseForPermission];

    await openPerson(view.wide);

    await cardOf(/No applications yet/);
    await rolesAnswered();
    expect(screen.queryByRole("button", { name: "Start an application" })).toBeNull();
    expect(callsTo("forms_submission_file")).toEqual([]);
  });
});

describe.each(widths)("the empty Wishes and issues card on $name", (view) => {
  it("carries Raise on their behalf, which asks title, topic and address, raises it for the person by phone and then lists it", async () => {
    await openPerson(view.wide);

    const card = await cardOf(/Nothing raised yet/);
    await userEvent.click(await within(card).findByRole("button", { name: "Raise on their behalf" }));
    const sheet = await screen.findByRole("dialog", { name: "Raise on their behalf" });
    await userEvent.type(within(sheet).getByLabelText("Title"), wishTitle);
    await userEvent.type(within(sheet).getByLabelText("Topic"), wishTopic);
    await userEvent.type(within(sheet).getByLabelText("Address"), wishAddress);
    await userEvent.click(within(sheet).getByRole("button", { name: "Raise" }));

    await waitFor(() => expect(callsTo("forms_catalog_raised_item_file")).toHaveLength(1));
    const sent = callsTo("forms_catalog_raised_item_file")[0] as Record<string, unknown>;
    expect(sent).toEqual(expect.objectContaining({ raised_by: personId, channel: "phone", title: wishTitle, topic: wishTopic }));
    expect(Object.values(sent)).toContain(wishAddress);
    const pane = document.querySelector(view.pane) as HTMLElement;
    expect(await within(pane).findByText(wishTitle)).toBeTruthy();
    expect(within(pane).queryByText(/Nothing raised yet/)).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps Raise disabled until the title is filled", async () => {
    await openPerson(view.wide);

    const card = await cardOf(/Nothing raised yet/);
    await userEvent.click(await within(card).findByRole("button", { name: "Raise on their behalf" }));
    const sheet = await screen.findByRole("dialog", { name: "Raise on their behalf" });

    expect(within(sheet).getByRole("button", { name: "Raise" })).toBeDisabled();
    expect(callsTo("forms_catalog_raised_item_file")).toEqual([]);
  });

  it("shows the card without Raise on their behalf to a reader who lacks the permission, even one who holds the other two acts", async () => {
    permissions = ["member.view", assignGroupPermission, fileApplicationPermission];

    await openPerson(view.wide);

    await cardOf(/Nothing raised yet/);
    await rolesAnswered();
    expect(screen.queryByRole("button", { name: "Raise on their behalf" })).toBeNull();
    expect(callsTo("forms_catalog_raised_item_file")).toEqual([]);
  });
});

describe.each(widths)("a row in the Groups section on $name", (view) => {
  beforeEach(() => {
    memberships = ["g2"];
  });

  it("goes to Groups & Associations with that group chosen", async () => {
    await openPerson(view.wide);

    await userEvent.click(await screen.findByRole("button", { name: new RegExp(wardGroup) }));

    await waitFor(() => expect(screen.getByTestId("here").textContent).toBe(residentPaths.groups.path({ group: "g2" })));
  });

  it("shows the chosen group's own detail there, not the first group in the list", async () => {
    await openPerson(view.wide);

    await userEvent.click(await screen.findByRole("button", { name: new RegExp(wardGroup) }));

    await waitFor(() => expect(callsTo("actor_get_group")).toContainEqual({ group_id: "g2" }));
    const pane = document.querySelector(view.pane) as HTMLElement;
    expect(await within(pane).findByText("Joining")).toBeTruthy();
    expect(within(pane).getByText(wardGroup)).toBeTruthy();
    expect(callsTo("actor_get_group")).not.toContainEqual({ group_id: "g1" });
  });
});

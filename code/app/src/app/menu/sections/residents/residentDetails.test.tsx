import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes as appRoutes } from "../../../routes";
import { answersOf, settingReply, settingsOf, type Settings } from "../../settingsFake";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Item = Record<string, unknown>;

let called: MockInstance<typeof mcp.callTool>;
let settings: Settings;
let people: Item[];

const attributeProperties = [
  { name: "phone", label: "Phone", range: "text", unique: true, required: false },
  { name: "email", label: "Email", range: "text", unique: true, required: false },
];

const language = (patch: Partial<{ on: boolean; required: boolean }> = {}) => ({ prompt: "Preferred language", on: true, required: false, own: true, ...patch });

const residentChoice = (...details: Item[]) => ({ "register_details:RESIDENT": { details } });

const hub = () => {
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
    const given = (args ?? {}) as Record<string, unknown>;
    const setting = settingReply(settings, tool, args);
    if (setting !== undefined) return setting;
    if (tool === "agency_get_my_roles") return { permissions: ["member.add", "member.edit", "member.view", "member.read"] };
    if (tool === "actor_list_actors") return { items: people };
    if (tool === "actor_get_actor") return people.find((person) => person.id === given.actor_id);
    if (tool === "actor_list_attribute_properties") return { items: attributeProperties };
    if (tool === "actor_create_actor") {
      const made = { id: `p${people.length + 1}`, status: "active", ...given };
      people = [...people, made];
      return made;
    }
    if (tool === "actor_set_actor_attributes") {
      people = people.map((person) => (person.id === given.actor_id ? { ...person, attributes: { ...(person.attributes as Item), ...(given.attributes as Item) } } : person));
      return {};
    }
    return { items: [] };
  });
};

const showForm = () =>
  render(
    <MemoryRouter initialEntries={[appRoutes.personNew.path()]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

const openPerson = async () => {
  const path = items.find((item) => item.title === "All People")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Szabó Katalin/ }));
  await screen.findByRole("button", { name: "Edit" });
};

const writesTo = (key: string) => called.mock.calls.filter(([, tool, args]) => tool === "forms_catalog_setting_write" && (args as Item).key === key);

beforeEach(() => {
  openAgency("town");
  settings = {};
  people = [{ id: "p1", display_name: "Szabó Katalin", status: "active", attributes: { phone: "+36 30 111 2222" } }];
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Add resident form with details chosen in Settings", () => {
  it("asks the owner's own detail and still asks Phone and Email", async () => {
    settings = settingsOf(residentChoice(language()));
    hub();
    showForm();

    expect(await screen.findByLabelText("Preferred language (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Email (optional)")).toBeInTheDocument();
  });

  it("leaves out a built-in detail that is switched off", async () => {
    settings = settingsOf(residentChoice({ prompt: "Email", on: false, required: false, own: false }, language()));
    hub();
    showForm();

    await screen.findByLabelText("Preferred language (optional)");
    expect(screen.getByLabelText("Phone (optional)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email (optional)")).toBeNull();
  });

  it("leaves out an own detail that is switched off", async () => {
    settings = settingsOf(residentChoice({ prompt: "Email", on: false, required: false, own: false }, language({ on: false }), { prompt: "Home district", on: true, required: false, own: true }));
    hub();
    showForm();

    await screen.findByLabelText("Home district (optional)");
    expect(screen.getByLabelText("Phone (optional)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Preferred language (optional)")).toBeNull();
    expect(screen.queryByLabelText("Preferred language")).toBeNull();
  });

  it("blocks Save until a required own detail is filled", async () => {
    const user = userEvent.setup();
    settings = settingsOf(residentChoice(language({ required: true })));
    hub();
    showForm();

    const required = await screen.findByLabelText("Preferred language");
    await user.type(screen.getByLabelText("Name"), "Varga Mária");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.type(required, "Hungarian");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("keeps the answer under register_answers:RESIDENT:<new actor id> after the actor is created, and not among the actor attributes", async () => {
    const user = userEvent.setup();
    settings = settingsOf(residentChoice(language()));
    hub();
    showForm();

    await user.type(await screen.findByLabelText("Name"), "Varga Mária");
    await user.type(screen.getByLabelText("Preferred language (optional)"), "Hungarian");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(answersOf(settings, "register_answers:RESIDENT:p2")).toEqual({ "Preferred language": "Hungarian" }));
    expect(called).toHaveBeenCalledWith("", "actor_create_actor", { display_name: "Varga Mária", is_agentic: false, attributes: {} });
    const created = called.mock.invocationCallOrder[called.mock.calls.findIndex(([, tool]) => tool === "actor_create_actor")];
    const written = called.mock.invocationCallOrder[called.mock.calls.findIndex(([, tool, args]) => tool === "forms_catalog_setting_write" && (args as Item).key === "register_answers:RESIDENT:p2")];
    expect(written).toBeGreaterThan(created);
  });

  it("writes no answers setting when the own detail is left empty", async () => {
    const user = userEvent.setup();
    settings = settingsOf(residentChoice(language()));
    hub();
    showForm();

    await screen.findByLabelText("Preferred language (optional)");
    await user.type(screen.getByLabelText("Name"), "Varga Mária");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_create_actor", expect.anything()));
    expect(writesTo("register_answers:RESIDENT:p2")).toHaveLength(0);
  });
});

describe("an opened resident with details chosen in Settings", () => {
  it("shows the stored answer of the owner's own detail", async () => {
    settings = settingsOf({ ...residentChoice(language()), "register_answers:RESIDENT:p1": { answers: { "Preferred language": "Hungarian" } } });
    hub();
    await openPerson();

    expect(await screen.findByText("Preferred language")).toBeInTheDocument();
    expect(screen.getByText("Hungarian")).toBeInTheDocument();
    expect(screen.getByText("+36 30 111 2222")).toBeInTheDocument();
  });

  it("writes the same setting when the answer is edited and shows the new answer", async () => {
    const user = userEvent.setup();
    settings = settingsOf({ ...residentChoice(language()), "register_answers:RESIDENT:p1": { answers: { "Preferred language": "Hungarian" } } });
    hub();
    await openPerson();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const field = await screen.findByLabelText("Preferred language");
    expect(field).toHaveValue("Hungarian");
    await user.clear(field);
    await user.type(field, "German");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(answersOf(settings, "register_answers:RESIDENT:p1")).toEqual({ "Preferred language": "German" }));
    expect(await screen.findByText("German")).toBeInTheDocument();
  });

  it("hides the answer of a detail switched off and keeps the others", async () => {
    settings = settingsOf({
      ...residentChoice(language({ on: false }), { prompt: "Home district", on: true, required: false, own: true }),
      "register_answers:RESIDENT:p1": { answers: { "Preferred language": "Hungarian", "Home district": "Malomsor" } },
    });
    hub();
    await openPerson();

    expect(await screen.findByText("Malomsor")).toBeInTheDocument();
    expect(screen.queryByText("Hungarian")).toBeNull();
    expect(screen.queryByText("Preferred language")).toBeNull();
  });

  it.each([
    ["no answers setting at all", null],
    ["an empty answers setting", ""],
  ])("opens a resident saved before with %s as it opens today, with no error and no empty row, and offers the new detail on edit", async (_label, empty) => {
    const user = userEvent.setup();
    settings = settingsOf(residentChoice(language()));
    hub();
    const read = called.getMockImplementation()!;
    called.mockImplementation(async (hubName, tool, args) =>
      tool === "forms_catalog_setting_read" && String((args as Item).key).startsWith("register_answers:") ? (empty === null ? null : { key: (args as Item).key, value: empty }) : read(hubName, tool, args),
    );
    await openPerson();

    expect(screen.getByText("+36 30 111 2222")).toBeInTheDocument();
    expect(screen.queryByText("Preferred language")).toBeNull();
    expect(screen.queryByText(/could not be loaded|did not go through/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByLabelText("Preferred language")).toHaveValue("");
  });
});

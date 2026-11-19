import { vi, type MockInstance } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes as appRoutes } from "../../../routes";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let called: MockInstance<typeof mcp.callTool>;
let person: Record<string, unknown>;

const attributeProperties = [
  { name: "phone", label: "Phone", range: "text", unique: true, required: false },
  { name: "email", label: "Email", range: "text", unique: true, required: false },
  { name: "date_of_birth", label: "Date of birth", range: "date", unique: false, required: false },
];

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }] };
  if (name === "agency_get_my_roles") return { permissions: ["member.add", "member.edit", "member.view", "member.read"] };
  if (name === "actor_list_actors") return { items: [person] };
  if (name === "actor_get_actor") return person;
  if (name === "actor_list_groups_for_actor" || name === "actor_list_groups") return { items: [] };
  if (name === "actor_list_attribute_properties") return { items: attributeProperties };
  if (name === "actor_set_actor_attributes") {
    person = { ...person, attributes: { ...((person.attributes as Record<string, unknown>) ?? {}), ...(given.attributes as Record<string, unknown>) } };
    return {};
  }
  if (name === "actor_create_actor") return { id: "p9", ...given };
  return { items: [] };
};

beforeEach(() => {
  openAgency("town");
  person = { id: "p1", display_name: "Sample Resident A", status: "active", attributes: { date_of_birth: "1984-03-09" } };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openPerson = async () => {
  const path = items.find((item) => item.title === "All People")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Sample Resident A/ }));
};

describe("a resident's date of birth", () => {
  it("reads on the Personal detail card as a day in words with its year", async () => {
    await openPerson();
    const card = await screen.findByRole("region", { name: "Personal detail" });
    expect(await within(card).findByText("Date of birth")).toBeInTheDocument();
    expect(within(card).getByText("Friday, 9 Mar 1984")).toBeInTheDocument();
    expect(within(card).queryByText("1984-03-09")).toBeNull();
  });

  it("is edited with a date picker and saved as a day", async () => {
    await openPerson();
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const field = (await screen.findByLabelText("Date of birth")) as HTMLInputElement;
    expect(field.type).toBe("date");
    expect(field.value).toBe("1984-03-09");
    fireEvent.change(field, { target: { value: "1985-04-10" } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_set_actor_attributes", expect.objectContaining({ actor_id: "p1", attributes: expect.objectContaining({ date_of_birth: "1985-04-10" }) })));
  });

  it("is offered as an optional date picker when a person is added, and sent as a day", async () => {
    render(
      <MemoryRouter initialEntries={[appRoutes.personNew.path()]}>
        <Routes>{routes()}</Routes>
      </MemoryRouter>,
    );
    const field = (await screen.findByLabelText("Date of birth (optional)")) as HTMLInputElement;
    expect(field.type).toBe("date");
    await userEvent.type(screen.getByLabelText("Name"), "Sample Resident B");
    fireEvent.change(field, { target: { value: "1990-12-31" } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_create_actor", expect.objectContaining({ display_name: "Sample Resident B", attributes: expect.objectContaining({ date_of_birth: "1990-12-31" }) })));
  });
});

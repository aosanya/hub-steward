import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { issuePaths } from "../issues/paths";
import { placePaths } from "../properties/paths";
import { servicesPaths } from "../services/paths";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const personName = "Sample Resident A";
const personId = "p1";

const answer = async (name: string) => {
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "forms" }] };
  if (name === "agency_get_my_roles") return { permissions: ["member.view"] };
  if (name === "actor_list_actors") return { items: [{ id: personId, display_name: personName, status: "active" }] };
  if (name === "actor_get_actor") return { id: personId, display_name: personName, status: "active" };
  if (name === "actor_list_groups_for_actor") return { items: [{ group_id: "g1" }] };
  if (name === "actor_list_groups") return { items: [{ id: "g1", name: "Sample Street Group" }] };
  if (name === "actor_list_attribute_properties") return { items: [] };
  if (name === "forms_submission_list_of_person") return { items: [{ id: "s1", form_id: "f1", form_title: "Sample Stall Permit", member_id: personId, submitted_at: "2026-11-03T09:30:00Z" }] };
  if (name === "forms_catalog_raised_item_list_of_person") return { items: [{ id: "w1", title: "Sample pothole wish", status: "open", created_at: "2026-11-04T09:30:00Z" }] };
  if (name === "digitaltwin_tenure_list") return { items: [{ id: "t1", place_id: "pl1", kind: "owner", since: "2026-01-02T00:00:00Z" }] };
  if (name === "digitaltwin_node_list") return { items: [{ id: "pl1", name: "Sample Corner Plot" }] };
  return { items: [] };
};

beforeEach(() => {
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => answer(name));
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
      <Routes>
        {routes()}
        <Route path={servicesPaths.application.pattern} element={<p>Application page</p>} />
        <Route path={issuePaths.issue.pattern} element={<p>Issue page</p>} />
        <Route path={placePaths.place.pattern} element={<p>Place page</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(personName) }));
  await screen.findByText("Sample Street Group");
};

describe("a row on a person's panel opens what it names", () => {
  it("opens the application from an Applications row", async () => {
    await openPerson();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Stall Permit/ }));
    expect(await screen.findByText("Application page")).toBeTruthy();
  });

  it("opens the wish or issue from a Wishes and issues row", async () => {
    await openPerson();
    await userEvent.click(await screen.findByRole("button", { name: /Sample pothole wish/ }));
    expect(await screen.findByText("Issue page")).toBeTruthy();
  });

  it("opens the property from a Holdings row", async () => {
    await openPerson();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Corner Plot/ }));
    expect(await screen.findByText("Place page")).toBeTruthy();
  });
});

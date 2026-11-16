import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const agencyWords = { People: "Residents", Person: "Resident" };

const answerWith = (words: Record<string, string>, people: unknown[]) => (_agency: string, name: string) => {
  if (name === "agency_get_agency") return Promise.resolve({ name: "Zoldhalom" });
  if (name === "agency_list_mounts") return Promise.resolve({ modules: [{ module: "actor", mounts: [{ name: "Residents", words }] }] });
  if (name === "actor_list_actors") return Promise.resolve({ items: people });
  if (name === "actor_get_actor") return Promise.resolve({ item: { id: "p1", display_name: "Amara Kole", status: "Active" } });
  if (name === "actor_list_groups_for_actor") return Promise.resolve({ items: [] });
  if (name === "actor_list_groups") return Promise.resolve({ items: [] });
  return Promise.reject(new Error(`${name}: unknown tool`));
};

const showPeople = () =>
  render(
    <MemoryRouter initialEntries={[residentPaths.people.path()]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the residents screens with an agency that lists words", () => {
  beforeEach(() => {
    vi.spyOn(mcp, "callTool").mockImplementation(async (agency, name) => answerWith(agencyWords, [])(agency, name));
  });

  it("shows the agency's word for people in the list title and the empty card", async () => {
    showPeople();

    expect(await screen.findByText("No residents yet.")).toBeInTheDocument();
    expect(screen.getAllByText("All Residents").length).toBeGreaterThan(0);
    expect(screen.queryByText("All People")).toBeNull();
  });

  it("shows the agency's word for the people and no generic word on the person's detail", async () => {
    vi.mocked(mcp.callTool).mockImplementation(async (agency, name) => answerWith(agencyWords, [{ id: "p1", display_name: "Amara Kole", status: "Active" }])(agency, name));
    showPeople();
    await userEvent.click(await screen.findByRole("button", { name: /Amara Kole/ }));

    expect(await screen.findByText("Not in any group yet.")).toBeInTheDocument();
    expect(screen.queryByText("Person")).toBeNull();
  });
});

describe("the residents screens with an agency that lists no words", () => {
  beforeEach(() => {
    vi.spyOn(mcp, "callTool").mockImplementation(async (agency, name) => answerWith({}, [])(agency, name));
  });

  it("shows the generic text", async () => {
    showPeople();

    expect(await screen.findByText("No people yet.")).toBeInTheDocument();
    expect(screen.getAllByText("All People").length).toBeGreaterThan(0);
  });
});

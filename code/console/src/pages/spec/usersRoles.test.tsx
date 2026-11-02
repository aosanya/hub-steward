import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../../i18n";
import type { UserLine } from "./usersRead";
import { RoleChips, UsersTable } from "./usersTable";

const grace: UserLine = {
  id: "grace",
  code: "",
  name: "Grace Test",
  groups: ["Siaya farmers", "Supplier"],
  roles: [{ group: "Siaya farmers", role: "Coordinator" }],
  joined: "2026-10-01T09:00:00Z",
};

const inPage = (node: React.ReactNode) =>
  render(
    <MemoryRouter>
      <I18nProvider initial={{ en: { "users.colUser": "User", "users.colGroups": "Groups", "users.colRole": "Role", "users.colJoined": "Joined", openHub: "Open", noRows: "None" } }}>{node}</I18nProvider>
    </MemoryRouter>,
  );

describe("the roles of a person", () => {
  it("name the group each role is held in", () => {
    inPage(<RoleChips hubId="h1" roles={grace.roles} withGroup />);
    expect(screen.getByText("Siaya farmers · Coordinator")).toBeTruthy();
  });

  it("draw one chip for each seat, not the first role found", () => {
    inPage(<RoleChips hubId="h1" roles={[...grace.roles, { group: "Supplier", role: "Member" }]} withGroup />);
    expect(screen.getByText("Siaya farmers · Coordinator")).toBeTruthy();
    expect(screen.getByText("Supplier · Member")).toBeTruthy();
  });

  it("leave the group out when the table has only one", () => {
    inPage(<RoleChips hubId="h1" roles={grace.roles} withGroup={false} />);
    expect(screen.getByText("Coordinator")).toBeTruthy();
  });

  it("are a dash when no seat is held", () => {
    inPage(<RoleChips hubId="h1" roles={[]} withGroup />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("show the group beside the role in the Users table when several groups are listed", () => {
    inPage(<UsersTable hubId="h1" lines={[grace]} />);
    expect(screen.getByText("Siaya farmers · Coordinator")).toBeTruthy();
  });
});

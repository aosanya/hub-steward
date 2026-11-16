import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { DepartmentsScreen, StaffScreen } from "./index";

const origin = { path: "/a/town/menu/staff", title: "Staff" };

const answering = (words: Record<string, string> | null) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
    if (name === "agency_get_agency") return { name: "Zoldhalom" };
    if (name === "agency_list_mounts") return words ? { modules: [{ module: "actor", mounts: [{ name: "Staff", words }] }] } : { modules: [] };
    return { items: [] };
  });

const open = (path: string, pattern: string, element: JSX.Element) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: path, state: { from: origin } }]}>
      <Routes>
        <Route path={`/a/:agencyId${pattern}`} element={element} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Staff screens in the agency's own words", () => {
  it("draws the title and the empty state of the staff list with the words the agency lists", async () => {
    answering({ Staff: "Employees" });
    open("/a/town/menu/staff/people", "/menu/staff/people", <StaffScreen />);

    expect(await screen.findByRole("heading", { name: "Employees" })).toBeInTheDocument();
    expect(await screen.findByText("No employees yet.")).toBeInTheDocument();
  });

  it("draws the title and the empty state of the departments with the words the agency lists", async () => {
    answering({ Departments: "Offices" });
    open("/a/town/menu/staff/departments", "/menu/staff/departments", <DepartmentsScreen />);

    expect(await screen.findByRole("heading", { name: "Offices" })).toBeInTheDocument();
    expect(await screen.findByText("No offices yet.")).toBeInTheDocument();
  });

  it("draws the generic words when the agency lists none", async () => {
    answering(null);
    open("/a/town/menu/staff/people", "/menu/staff/people", <StaffScreen />);

    expect(await screen.findByRole("heading", { name: "Staff" })).toBeInTheDocument();
    expect(await screen.findByText("No staff yet.")).toBeInTheDocument();
  });
});

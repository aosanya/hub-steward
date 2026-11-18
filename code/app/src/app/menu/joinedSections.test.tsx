import { vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import { menuRoutes } from "./routes";

let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

beforeEach(() => {
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => (name.includes("_list") ? { items: [] } : Promise.reject(new Error(`${name}: unknown tool`))));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const cases = [
  { id: "residents", section: "People", submenu: "All People", opens: "/a/town/menu/residents/people" },
  { id: "properties", section: "Places & Addresses", submenu: "Places", opens: "/a/town/menu/properties/places" },
  { id: "assets", section: "Assets & Works", submenu: "Equipment", opens: "/a/town/menu/assets/equipment" },
  { id: "staff", section: "Staff & Departments", submenu: "Departments", opens: "/a/town/menu/staff/departments" },
  { id: "issues", section: "Issues & Requests", submenu: "All Issues", opens: "/a/town/menu/issues/all" },
  { id: "settings", section: "Settings", submenu: "Integrations", opens: "/a/town/menu/settings/integrations" },
  { id: "settings", section: "Settings", submenu: "Audit Log", opens: "/a/town/menu/settings/audit-log" },
  { id: "council", section: "Decisions", submenu: "Meetings", opens: "/a/town/menu/council/meetings" },
  { id: "council", section: "Decisions", submenu: "Agendas & Minutes", opens: "/a/town/menu/council/agendas" },
  { id: "council", section: "Decisions", submenu: "Resolutions", opens: "/a/town/menu/council/resolutions" },
  { id: "council", section: "Decisions", submenu: "Rules", opens: "/a/town/menu/council/bylaws" },
  { id: "council", section: "Decisions", submenu: "Committees", opens: "/a/town/menu/council/committees" },
  { id: "finance", section: "Finance", submenu: "Budget", opens: "/a/town/menu/finance/budget" },
  { id: "finance", section: "Finance", submenu: "Spending by Neighbourhood", opens: "/a/town/menu/finance/spending-by-neighbourhood" },
  { id: "finance", section: "Finance", submenu: "Revenue & Billing", opens: "/a/town/menu/finance/revenue-and-billing" },
  { id: "finance", section: "Finance", submenu: "Procurement", opens: "/a/town/menu/finance/procurement" },
  { id: "finance", section: "Finance", submenu: "Payments", opens: "/a/town/menu/finance/payments" },
  { id: "finance", section: "Finance", submenu: "Financial Reports", opens: "/a/town/menu/finance/reports" },
  { id: "finance", section: "Finance", submenu: "National Report", opens: "/a/town/menu/finance/national-report" },
  { id: "services", section: "Services & Permits", submenu: "Applications", opens: "/a/town/menu/services/applications" },
  { id: "services", section: "Services & Permits", submenu: "Permits", opens: "/a/town/menu/services/permits" },
  { id: "services", section: "Services & Permits", submenu: "Licences", opens: "/a/town/menu/services/licences" },
  { id: "services", section: "Services & Permits", submenu: "Fees & Payments", opens: "/a/town/menu/services/fees" },
  { id: "services", section: "Services & Permits", submenu: "Service Catalogue", opens: "/a/town/menu/services/catalogue" },
];

const section = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/a/town/menu/${id}`]}>
      <Routes>{menuRoutes()}</Routes>
      <Where />
    </MemoryRouter>,
  );

describe.each(cases)("the $section submenu $submenu", ({ id, section: title, submenu, opens }) => {
  it("opens its screen and Back returns to the section", async () => {
    section(id);

    await userEvent.click(screen.getByRole("button", { name: new RegExp(submenu) }));
    await waitFor(() => expect(landed).toBe(opens));
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(title.replace("&", "\\&")) }));

    await waitFor(() => expect(landed).toBe(`/a/town/menu/${id}`));
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  });
});

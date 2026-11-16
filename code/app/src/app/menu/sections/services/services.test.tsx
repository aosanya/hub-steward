import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { ApplicationScreen, FeesPaymentsScreen, LicencesScreen, PermitsScreen, ServiceCatalogueScreen } from "./ServicesScreens";
import { items, routes } from "./index";

type Args = Record<string, unknown>;

const submissions = [
  { id: "s1", form_id: "f1", member_id: "m1", kind: "permit", name: "Market Stall Permit", sent_at: "2026-03-04T12:00:00Z", status: "Submitted" },
  { id: "s2", form_id: "f2", member_id: "m2", kind: "permit", name: "Street Party Permit", sent_at: "2026-03-09T12:00:00Z", status: "Approved" },
  { id: "s3", form_id: "f3", member_id: "m3", kind: "licence", name: "Dog Licence", sent_at: "2026-03-11T12:00:00Z", status: "Issued" },
  { id: "s4", form_id: "f4", member_id: "m4", kind: "fee", name: "Hall Hire Fee", sent_at: "2026-03-12T12:00:00Z", status: "Unpaid" },
  { id: "s5", form_id: "f5", member_id: "m5", kind: "fee", name: "Parking Fee", sent_at: "2026-03-14T12:00:00Z", status: "Unpaid" },
];

const catalogue = [
  { id: "c1", name: "Bulk Waste Collection", summary: "Book a collection for large items" },
  { id: "c2", name: "Allotment Waiting List", summary: "Ask for a plot near you" },
];

const application = { id: "s1", form_id: "f1", status: "Submitted", sent_at: "2026-03-04T12:00:00Z" };

const applicationAnswers = [
  { prompt: "Stall location", answer: "Riverside Square" },
  { prompt: "Number of trading days", answer: "Three" },
];

const dayWords = (day: number) => new RegExp(`2026-03-${String(day).padStart(2, "0")}|${day} Mar|Mar ${day}\\b|${String(day).padStart(2, "0")}/03|03/${String(day).padStart(2, "0")}`);

const origin = { path: "/a/town/menu/services", title: "Services & Permits" };

const screens = [
  { title: "Permits", at: "/a/town/menu/services/permits", pattern: "/a/:agencyId/menu/services/permits", Screen: PermitsScreen, tool: "forms_submission_list" },
  { title: "Licences", at: "/a/town/menu/services/licences", pattern: "/a/:agencyId/menu/services/licences", Screen: LicencesScreen, tool: "forms_submission_list" },
  { title: "Fees & Payments", at: "/a/town/menu/services/fees", pattern: "/a/:agencyId/menu/services/fees", Screen: FeesPaymentsScreen, tool: "forms_submission_list" },
  { title: "Service Catalogue", at: "/a/town/menu/services/catalogue", pattern: "/a/:agencyId/menu/services/catalogue", Screen: ServiceCatalogueScreen, tool: "forms_catalog_entry_list_public" },
];

const applicationAt = (id: string) => `/a/town/menu/services/applications/${id}`;

let landed = "";
let called: MockInstance<typeof mcp.callTool>;
let answers: Record<string, (args: Args) => unknown>;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

beforeEach(() => {
  openAgency("town");
  answers = {
    forms_submission_list: () => ({ items: submissions }),
    forms_submission_mark_paid: () => ({}),
    forms_catalog_entry_list_public: () => ({ items: catalogue }),
    forms_submission_read_mine: () => application,
    forms_answer_list: () => ({ items: applicationAnswers }),
    forms_form_withdraw: () => ({}),
  };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const answer = answers[name];
    if (!answer) throw new Error(`${name} is not a tool this screen may use`);
    return answer((args ?? {}) as Args);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const toolsCalled = () => new Set(called.mock.calls.map(([, name]) => name));

const open = (at: string, state: unknown = { from: origin }) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: at, state }]}>
      <Routes>
        {screens.map(({ pattern, Screen }) => (
          <Route key={pattern} path={pattern} element={<Screen />} />
        ))}
        <Route path="/a/:agencyId/menu/services/applications/:id" element={<ApplicationScreen />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const pathOf = (item: { path: unknown }) => (typeof item.path === "function" ? (item.path as () => string)() : String(item.path));

describe("the Services & Permits section's menu", () => {
  it("lists Permits, Licences, Fees & Payments and the Service Catalogue", () => {
    const titles = items.map((item) => item.title);

    ["Permits", "Licences", "Fees & Payments", "Service Catalogue"].forEach((title) => expect(titles).toContain(title));
  });

  it("gives each screen its own path inside the Services section", () => {
    const paths = items.map(pathOf);

    paths.forEach((path) => expect(path).toMatch(/^\/a\/town\/menu\/services\/[a-z-]+$/));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("exports the routes that serve those screens", () => {
    expect(routes).toBeTruthy();
  });
});

describe("Permits", () => {
  it("draws a row for each permit with its date and status, and leaves other kinds out", async () => {
    open(screens[0].at);

    expect(await screen.findByText("Market Stall Permit")).toBeInTheDocument();
    expect(screen.getByText("Street Party Permit")).toBeInTheDocument();
    expect(screen.getByText(/Submitted/)).toBeInTheDocument();
    expect(screen.getByText(/Approved/)).toBeInTheDocument();
    expect(screen.getByText(dayWords(4))).toBeInTheDocument();
    expect(screen.getByText(dayWords(9))).toBeInTheDocument();
    expect(screen.queryByText("Dog Licence")).toBeNull();
    expect(screen.queryByText("Hall Hire Fee")).toBeNull();
    expect(toolsCalled()).toEqual(new Set(["forms_submission_list"]));
  });
});

describe("Licences", () => {
  it("draws a row for each licence with its date and status, and leaves other kinds out", async () => {
    open(screens[1].at);

    expect(await screen.findByText("Dog Licence")).toBeInTheDocument();
    expect(screen.getByText(/Issued/)).toBeInTheDocument();
    expect(screen.getByText(dayWords(11))).toBeInTheDocument();
    expect(screen.queryByText("Market Stall Permit")).toBeNull();
    expect(screen.queryByText("Parking Fee")).toBeNull();
    expect(toolsCalled()).toEqual(new Set(["forms_submission_list"]));
  });
});

describe("Fees & Payments", () => {
  it("draws a row for each fee with its date and status, and leaves other kinds out", async () => {
    open(screens[2].at);

    expect(await screen.findByText("Hall Hire Fee")).toBeInTheDocument();
    expect(screen.getByText("Parking Fee")).toBeInTheDocument();
    expect(screen.getAllByText(/Unpaid/)).toHaveLength(2);
    expect(screen.getByText(dayWords(12))).toBeInTheDocument();
    expect(screen.getByText(dayWords(14))).toBeInTheDocument();
    expect(screen.queryByText("Dog Licence")).toBeNull();
    expect(screen.queryByText("Street Party Permit")).toBeNull();
  });

  it("offers Mark paid on each fee and records the send that was pressed", async () => {
    open(screens[2].at);
    await screen.findByText("Parking Fee");
    const buttons = await screen.findAllByRole("button", { name: /Mark paid/ });

    expect(buttons).toHaveLength(2);
    await userEvent.click(buttons[1]);

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_submission_mark_paid", expect.objectContaining({ form_id: "f5", member_id: "m5", paid: true })));
    expect(called).not.toHaveBeenCalledWith("", "forms_submission_mark_paid", expect.objectContaining({ member_id: "m4" }));
  });

  it("offers no Mark paid on the permit and licence screens", async () => {
    open(screens[0].at);
    await screen.findByText("Market Stall Permit");

    expect(screen.queryByRole("button", { name: /Mark paid/ })).toBeNull();
  });
});

describe("Service Catalogue", () => {
  it("draws a row for each public service with its name and line", async () => {
    open(screens[3].at);

    expect(await screen.findByText("Bulk Waste Collection")).toBeInTheDocument();
    expect(screen.getByText("Allotment Waiting List")).toBeInTheDocument();
    expect(screen.getByText("Book a collection for large items")).toBeInTheDocument();
    expect(screen.getByText("Ask for a plot near you")).toBeInTheDocument();
    expect(toolsCalled()).toEqual(new Set(["forms_catalog_entry_list_public"]));
  });
});

describe("an application", () => {
  it("shows its status and the answers that were sent", async () => {
    open(applicationAt("f1"));

    expect(await screen.findByText("Submitted")).toBeInTheDocument();
    expect(await screen.findByText("Stall location")).toBeInTheDocument();
    expect(screen.getByText("Riverside Square")).toBeInTheDocument();
    expect(screen.getByText("Number of trading days")).toBeInTheDocument();
    expect(screen.getByText("Three")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "forms_submission_read_mine", { form_id: "f1" });
    expect(called).toHaveBeenCalledWith("", "forms_answer_list", { form_id: "f1" });
  });

  it("withdraws the application with the Withdraw button", async () => {
    open(applicationAt("f1"));

    await userEvent.click(await screen.findByRole("button", { name: /Withdraw/ }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_form_withdraw", { form_id: "f1" }));
  });

  it("has a Back button that reads the screen the application was opened from", async () => {
    open(applicationAt("f1"), { from: { path: screens[0].at, title: "Permits" } });
    await screen.findByText("Submitted");

    await userEvent.click(screen.getByRole("button", { name: /Permits/ }));

    await waitFor(() => expect(landed).toBe(screens[0].at));
  });
});

describe.each(screens)("$title as a screen of the Services & Permits section", ({ title, at, tool }) => {
  it("has a Back button that reads Services & Permits and goes there", async () => {
    open(at);
    await waitFor(() => expect(called).toHaveBeenCalled());

    await userEvent.click(await screen.findByRole("button", { name: /Services & Permits/ }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("reads another origin's name when the person came from somewhere else", async () => {
    open(at, { from: { path: "/a/town/menu/residents", title: "People" } });
    await waitFor(() => expect(called).toHaveBeenCalled());

    expect(await screen.findByRole("button", { name: /People/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Services & Permits/ })).toBeNull();
  });

  it("shows the empty state as a card with its act inside it when nothing came back", async () => {
    answers[tool] = () => ({ items: [] });
    open(at);

    await waitFor(() => expect(document.querySelector(".card button")).not.toBeNull());
    const card = (document.querySelector(".card button") as HTMLElement).closest(".card") as HTMLElement;
    expect(card.querySelector("p")?.textContent).not.toBe("");
    expect(card.querySelector("svg, img")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  });
});

import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { ApplicationScreen } from "./ApplicationScreen";
import { ApplicationsScreen } from "./ApplicationsScreen";
import { FeesPaymentsScreen, LicencesScreen, PermitsScreen, ServiceCatalogueScreen } from "./ServicesScreens";
import { items, routes } from "./index";

type Args = Record<string, unknown>;

const entries = [
  { id: "e1", slug: "market-stall-permit", name: "Market Stall Permit", summary: "Trade on the square", kind: "permit", form_id: "f1" },
  { id: "e2", slug: "street-party-permit", name: "Street Party Permit", summary: "Close your street for a day", kind: "permit", form_id: "f2" },
  { id: "e3", slug: "dog-licence", name: "Dog Licence", summary: "Keep a dog in town", kind: "licence", form_id: "f3" },
  { id: "e4", slug: "hall-hire-fee", name: "Hall Hire Fee", summary: "Hire the town hall", kind: "fee", form_id: "f4" },
  { id: "e5", slug: "parking-fee", name: "Parking Fee", summary: "Park on the square", kind: "fee", form_id: "f5" },
];

const sentOn = {
  "market-stall-permit": [{ id: "s1", form_id: "f1", member_id: "m1", submitted_at: "2026-03-04T12:00:00Z", paid: false }],
  "street-party-permit": [{ id: "s2", form_id: "f2", member_id: "m1", submitted_at: "2026-03-09T12:00:00Z", withdrawn_at: "2026-03-10T12:00:00Z", paid: false }],
  "dog-licence": [{ id: "s3", form_id: "f3", member_id: "m1", submitted_at: "2026-03-11T12:00:00Z", paid: false }],
  "hall-hire-fee": [{ id: "s4", form_id: "f4", member_id: "m1", submitted_at: "2026-03-12T12:00:00Z", paid: false }],
  "parking-fee": [{ id: "s5", form_id: "f5", member_id: "m1", submitted_at: "2026-03-14T12:00:00Z", paid: true, paid_at: "2026-03-15T12:00:00Z" }],
} as Record<string, unknown[]>;

const catalogue = [
  { id: "c1", slug: "bulk-waste", name: "Bulk Waste Collection", summary: "Book a collection for large items" },
  { id: "c2", slug: "allotments", name: "Allotment Waiting List", summary: "Ask for a plot near you" },
];

const application = { id: "s1", form_id: "f1", status: "Submitted", sent_at: "2026-03-04T12:00:00Z" };

const applicationQuestions = [
  { id: "q1", prompt: "Stall location" },
  { id: "q2", prompt: "Number of trading days" },
];

const applicationAnswers = [
  { id: "a1", question_id: "q1", value_text: "Riverside Square" },
  { id: "a2", question_id: "q2", value_text: "Three" },
];

const dayWords = (day: number) => new RegExp(`2026-03-${String(day).padStart(2, "0")}|${day} Mar|Mar ${day}\\b|${String(day).padStart(2, "0")}/03|03/${String(day).padStart(2, "0")}`);

const origin = { path: "/a/town/menu/services", title: "Services & Permits" };

const answeredForms = [
  { send_id: "n1", form_id: "f1", title: "Market stall application", answered_at: "2026-03-04T12:00:00Z", open: true },
  { send_id: "n2", form_id: "f9", title: "Fence permit application", answered_at: "2026-03-20T12:00:00Z", open: false },
];

const screens = [
  { title: "Permits", at: "/a/town/menu/services/permits", pattern: "/a/:agencyId/menu/services/permits", Screen: PermitsScreen, tool: "forms_catalog_entry_list_public" },
  { title: "Licences", at: "/a/town/menu/services/licences", pattern: "/a/:agencyId/menu/services/licences", Screen: LicencesScreen, tool: "forms_catalog_entry_list_public" },
  { title: "Fees & Payments", at: "/a/town/menu/services/fees", pattern: "/a/:agencyId/menu/services/fees", Screen: FeesPaymentsScreen, tool: "forms_catalog_entry_list_public" },
  { title: "Service Catalogue", at: "/a/town/menu/services/catalogue", pattern: "/a/:agencyId/menu/services/catalogue", Screen: ServiceCatalogueScreen, tool: "forms_catalog_entry_list_public" },
  { title: "Applications", at: "/a/town/menu/services/applications", pattern: "/a/:agencyId/menu/services/applications", Screen: ApplicationsScreen, tool: "forms_form_list_answered" },
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
    forms_submission_mark_paid: () => ({}),
    forms_catalog_entry_list_public: (args) => ({ items: args.kind ? entries.filter((entry) => entry.kind === args.kind) : catalogue }),
    forms_catalog_entry_submissions_mine: (args) => sentOn[String(args.slug)] ?? [],
    forms_submission_read_mine: () => application,
    forms_question_list: () => ({ items: applicationQuestions }),
    forms_answer_list: () => ({ items: applicationAnswers }),
    forms_form_withdraw: () => ({}),
    forms_form_list_answered: () => ({ items: answeredForms }),
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

const toolsCalled = () => new Set(called.mock.calls.map(([, name]) => name).filter((name) => !name.startsWith("agency_")));

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
  it("lists the permit entries of the catalogue and leaves other kinds out", async () => {
    open(screens[0].at);

    expect(await screen.findByText("Market Stall Permit")).toBeInTheDocument();
    expect(screen.getByText("Street Party Permit")).toBeInTheDocument();
    expect(screen.getByText("Trade on the square")).toBeInTheDocument();
    expect(screen.queryByText("Dog Licence")).toBeNull();
    expect(screen.queryByText("Hall Hire Fee")).toBeNull();
    expect(called).toHaveBeenCalledWith("", "forms_catalog_entry_list_public", { kind: "permit" });
    expect(toolsCalled()).not.toContain("forms_submission_list");
    expect(toolsCalled()).not.toContain("forms_catalog_entry_submissions_mine");
  });

  it("opens a permit to the person's own submissions with their date and status", async () => {
    open(screens[0].at);

    await userEvent.click(await screen.findByText("Market Stall Permit"));

    expect(await screen.findByText("Sent")).toBeInTheDocument();
    expect(screen.getByText(dayWords(4))).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "forms_catalog_entry_submissions_mine", { slug: "market-stall-permit" });
    expect(called).not.toHaveBeenCalledWith("", "forms_submission_list", expect.anything());
  });

  it("reads a withdrawn submission as Withdrawn", async () => {
    open(screens[0].at);

    await userEvent.click(await screen.findByText("Street Party Permit"));

    expect(await screen.findByText("Withdrawn")).toBeInTheDocument();
  });

  it("says nothing was sent when the person has no submission to the entry", async () => {
    answers.forms_catalog_entry_submissions_mine = () => [];
    open(screens[0].at);

    await userEvent.click(await screen.findByText("Market Stall Permit"));

    expect(await screen.findByText("Not sent yet")).toBeInTheDocument();
  });
});

describe("Licences", () => {
  it("lists the licence entries of the catalogue and opens one to its submissions", async () => {
    open(screens[1].at);

    await userEvent.click(await screen.findByText("Dog Licence"));

    expect(await screen.findByText("Sent")).toBeInTheDocument();
    expect(screen.getByText(dayWords(11))).toBeInTheDocument();
    expect(screen.queryByText("Market Stall Permit")).toBeNull();
    expect(screen.queryByText("Parking Fee")).toBeNull();
    expect(called).toHaveBeenCalledWith("", "forms_catalog_entry_list_public", { kind: "licence" });
    expect(called).toHaveBeenCalledWith("", "forms_catalog_entry_submissions_mine", { slug: "dog-licence" });
  });
});

describe("Fees & Payments", () => {
  it("lists the fee entries of the catalogue and leaves other kinds out", async () => {
    open(screens[2].at);

    expect(await screen.findByText("Hall Hire Fee")).toBeInTheDocument();
    expect(screen.getByText("Parking Fee")).toBeInTheDocument();
    expect(screen.queryByText("Dog Licence")).toBeNull();
    expect(screen.queryByText("Street Party Permit")).toBeNull();
    expect(called).toHaveBeenCalledWith("", "forms_catalog_entry_list_public", { kind: "fee" });
  });

  it("offers Mark paid on an unpaid fee and marks the submission that was sent", async () => {
    open(screens[2].at);

    await userEvent.click(await screen.findByText("Hall Hire Fee"));
    await userEvent.click(await screen.findByRole("button", { name: /Mark paid/ }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_submission_mark_paid", { form_id: "f4", member_id: "m1", paid: true }));
  });

  it("reads a paid fee as Paid and offers no Mark paid", async () => {
    open(screens[2].at);

    await userEvent.click(await screen.findByText("Parking Fee"));

    expect(await screen.findByText("Paid")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark paid/ })).toBeNull();
  });

  it("offers no Mark paid on the permit and licence screens", async () => {
    open(screens[0].at);
    await userEvent.click(await screen.findByText("Market Stall Permit"));
    await screen.findByText("Sent");

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

describe("Applications", () => {
  it("lists the forms the person sent, newest first, from the answered forms only", async () => {
    open(screens[4].at);

    const fence = await screen.findByText("Fence permit application");
    const stall = screen.getByText("Market stall application");
    expect(fence.compareDocumentPosition(stall) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(called).toHaveBeenCalledWith("", "forms_form_list_answered", undefined);
    expect(toolsCalled()).not.toContain("forms_form_list_waiting");
  });

  it("opens the application detail with Withdraw when a row is tapped", async () => {
    open(screens[4].at);

    await userEvent.click(await screen.findByText("Market stall application"));

    await waitFor(() => expect(landed).toBe(applicationAt("f1")));
    expect(await screen.findByRole("button", { name: /Withdraw/ })).toBeInTheDocument();
  });

  it("opens the detail with a Back button that reads Applications and returns to the list", async () => {
    open(screens[4].at);
    await userEvent.click(await screen.findByText("Fence permit application"));
    await screen.findByText("Sent");

    await userEvent.click(screen.getByRole("button", { name: /Applications/ }));

    await waitFor(() => expect(landed).toBe(screens[4].at));
  });

  it("is a row of the Services & Permits menu", () => {
    expect(items.map((item) => item.title)).toContain("Applications");
    expect(pathOf(items.find((item) => item.title === "Applications") as { path: unknown })).toBe("/a/town/menu/services/applications");
  });
});

describe("an application", () => {
  it("shows its status and the answers that were sent", async () => {
    open(applicationAt("f1"));

    expect(await screen.findByText("Sent")).toBeInTheDocument();
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
    await screen.findByText("Sent");

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

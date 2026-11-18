import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AssistantPage } from "../../../../features/assistant/AssistantPage";
import { type AssistantClient } from "../../../../features/assistant/api";
import { routes as appRoutes } from "../../../routes";
import { carriedChatAbout, carriedChatFrom, forgetChatAbout } from "../../../chatAbout";
import { ApplicationsScreen } from "./ApplicationsScreen";
import { FeesPaymentsScreen, LicencesScreen, PermitsScreen, ServiceCatalogueScreen } from "./ServicesScreens";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown>;

const entries = [
  { id: "e1", slug: "market-stall-permit", name: "Market Stall Permit", summary: "Trade on the square", kind: "permit", form_id: "f1" },
  { id: "e3", slug: "dog-licence", name: "Dog Licence", summary: "Keep a dog in town", kind: "licence", form_id: "f3" },
  { id: "e4", slug: "hall-hire-fee", name: "Hall Hire Fee", summary: "Hire the town hall", kind: "fee", form_id: "f4" },
];

const catalogue = [{ id: "c1", slug: "bulk-waste", name: "Bulk Waste Collection", summary: "Book a collection for large items" }];

const sentOn: Record<string, unknown[]> = {
  "market-stall-permit": [{ id: "s1", form_id: "f1", member_id: "m1", submitted_at: "2026-03-04T12:00:00Z", paid: false }],
  "dog-licence": [{ id: "s3", form_id: "f3", member_id: "m1", submitted_at: "2026-03-11T12:00:00Z", paid: false }],
  "hall-hire-fee": [{ id: "s4", form_id: "f4", member_id: "m1", submitted_at: "2026-03-12T12:00:00Z", paid: false }],
};

const answeredForms = [{ send_id: "n1", form_id: "f1", title: "Market stall application", answered_at: "2026-03-04T12:00:00Z", open: true }];

const answers: Record<string, (args: Args) => unknown> = {
  forms_catalog_entry_list_public: (args) => ({ items: args.kind ? entries.filter((entry) => entry.kind === args.kind) : catalogue }),
  forms_catalog_entry_submissions_mine: (args) => sentOn[String(args.slug)] ?? [],
  forms_catalog_entry_read: (args) => ({ item: catalogue.find((entry) => entry.slug === args.slug) ?? {} }),
  forms_submission_read_mine: () => ({ id: "s1", form_id: "f1", status: "Submitted", sent_at: "2026-03-04T12:00:00Z" }),
  forms_question_list: () => ({ items: [{ id: "q1", prompt: "Stall location" }] }),
  forms_answer_list: () => ({ items: [{ id: "a1", question_id: "q1", value_text: "Riverside Square" }] }),
  forms_form_read: (args) => ({ id: args.form_id, amount: 4500 }),
  actor_get_actor: () => ({ id: "m1", display_name: "Kovács Márta" }),
  forms_form_list_answered: () => ({ items: answeredForms }),
};

const assistantClient: AssistantClient = { model: async () => "acc1", ask: async () => ({ text: "ok", lists: [] }) };

beforeEach(() => {
  openAgency("town");
  forgetChatAbout();
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const answer = answers[name];
    if (!answer) return { items: [] };
    return answer((args ?? {}) as Args);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const openScreen = (path: string, Screen: () => JSX.Element, search: string) => {
  setWide(true);
  render(
    <MemoryRouter initialEntries={[`/a/town/menu/services/${path}${search}`]}>
      <Routes>
        <Route path={`/a/:agencyId/menu/services/${path}`} element={<Screen />} />
        <Route path={appRoutes.assistant.pattern} element={<AssistantPage client={assistantClient} />} />
      </Routes>
    </MemoryRouter>,
  );
};

const chatAbout = async (name: string) => {
  await userEvent.click(screen.getByRole("link", { name: "Chat" }));
  await screen.findByText(`About ${name}`);
  expect(screen.getByRole("textbox", { name: `Ask about ${name}` })).toBeInTheDocument();
};

describe("Chat in the bar on a permit's page", () => {
  it("opens the assistant about the chosen permit, with its form for the received applications", async () => {
    openScreen("permits", PermitsScreen, "?item=market-stall-permit");
    await screen.findByRole("heading", { level: 1, name: "Market Stall Permit" });
    await chatAbout("Market Stall Permit");
    expect(carriedChatAbout()).toEqual({ kind: "permit", id: "market-stall-permit", name: "Market Stall Permit", extra: { form: "f1" } });
    expect(carriedChatFrom()).toBe("/a/town/menu/services/permits?item=market-stall-permit");
  });

  it("carries nothing while no permit is chosen, so the Chat tab opens the plain assistant", async () => {
    openScreen("permits", PermitsScreen, "");
    await screen.findByRole("button", { name: /Market Stall Permit/ });
    expect(carriedChatAbout()).toBeNull();
  });
});

describe("Chat in the bar on a licence's, a fee's and a service's page", () => {
  it("opens the assistant about the chosen licence", async () => {
    openScreen("licences", LicencesScreen, "?item=dog-licence");
    await screen.findByRole("heading", { level: 1, name: "Dog Licence" });
    await chatAbout("Dog Licence");
    expect(carriedChatAbout()).toEqual({ kind: "licence", id: "dog-licence", name: "Dog Licence", extra: { form: "f3" } });
  });

  it("opens the assistant about the chosen fee, with its form and its payer", async () => {
    openScreen("fees", FeesPaymentsScreen, "?item=hall-hire-fee");
    await screen.findByRole("heading", { level: 1, name: "Hall Hire Fee" });
    await chatAbout("Hall Hire Fee");
    expect(carriedChatAbout()).toEqual({ kind: "fee", id: "hall-hire-fee", name: "Hall Hire Fee", extra: { form: "f4", payer: "m1" } });
  });

  it("opens the assistant about the chosen service", async () => {
    openScreen("catalogue", ServiceCatalogueScreen, "?item=bulk-waste");
    await screen.findByRole("heading", { level: 1, name: "Bulk Waste Collection" });
    await chatAbout("Bulk Waste Collection");
    expect(carriedChatAbout()).toEqual({ kind: "service", id: "bulk-waste", name: "Bulk Waste Collection" });
  });
});

describe("Chat in the bar on an application's page", () => {
  it("opens the assistant about the chosen application", async () => {
    openScreen("applications", ApplicationsScreen, "?item=f1");
    await screen.findByRole("heading", { level: 1, name: "Market stall application" });
    await chatAbout("Market stall application");
    expect(carriedChatAbout()).toEqual({ kind: "application", id: "f1", name: "Market stall application" });
    expect(carriedChatFrom()).toBe("/a/town/menu/services/applications?item=f1");
  });

  it("carries nothing while no application is chosen", async () => {
    openScreen("applications", ApplicationsScreen, "");
    await screen.findByRole("button", { name: /Market stall application/ });
    expect(carriedChatAbout()).toBeNull();
  });
});

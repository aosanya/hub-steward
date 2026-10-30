import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { forgetOpenAgency, openAgencyId } from "../agency/open";
import * as mcp from "../wakala/mcp";
import { provideEntryClient, type Agency, type EntryClient } from "./api";
import { formsWaiting, provideWaitingCount, restoreWaitingCount, waitingCount } from "./waiting";
import { wordsFor } from "./language";
import { swahili } from "./swahili";
import { words } from "./words";

const lab: Agency = { id: "56af4999-1de9-535f-beaa-b1824294c82f", name: "Siaya Community Computer Lab" };
const farmers: Agency = { id: "270e07b7-6b69-55ca-aa30-9441ce138541", name: "Siaya Farmers' Group" };
const riders: Agency = { id: "c61e4358-10fd-539b-89f5-a7ccf4e94479", name: "Siaya Boda Boda Riders" };

const waitingIn: Record<string, number> = { [farmers.id]: 2 };

const client = (agencies: Agency[]): EntryClient => ({
  sendSignInLink: async () => "sent",
  listAgencies: async () => agencies,
  searchDirectory: async () => [],
  join: async () => "joined",
});

const at = (path: string, agencies: Agency[]) => {
  provideEntryClient(client(agencies));
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  forgetOpenAgency();
  provideWaitingCount(async (id) => waitingIn[id] ?? 0);
});

afterEach(restoreWaitingCount);

describe("your agencies with forms waiting", () => {
  it("shows the count on the agency that has forms waiting and nowhere else", async () => {
    at("/agencies", [lab, farmers, riders]);
    expect(await screen.findByText(formsWaiting(2, words))).toBeInTheDocument();
    expect(screen.getAllByText(/forms? waiting/)).toHaveLength(1);
    const row = screen.getByRole("button", { name: new RegExp(farmers.name) });
    expect(within(row).getByText(formsWaiting(2, words))).toBeInTheDocument();
    expect(within(row).queryByText(farmers.id)).toBeNull();
    expect(screen.queryByText(lab.id)).toBeNull();
  });

  it("says one form in the singular", () => {
    expect(formsWaiting(1, words)).toBe("1 form waiting");
  });

  it("says the count in Kiswahili once that language is chosen", async () => {
    window.localStorage.setItem("hub.language", "sw");
    at("/agencies", [lab, farmers, riders]);
    expect(await screen.findByText(formsWaiting(2, swahili))).toBeInTheDocument();
    expect(formsWaiting(2, wordsFor("sw"))).toBe("fomu 2 zinasubiri");
    expect(formsWaiting(1, wordsFor("sw"))).toBe("fomu 1 inasubiri");
    window.localStorage.clear();
  });

  it("counts the waiting forms of one agency with the tool the Forms page calls", async () => {
    restoreWaitingCount();
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [{}, {}, {}] } as never);
    expect(await waitingCount(farmers.id)).toBe(3);
    expect(call).toHaveBeenCalledWith(farmers.id, "forms_form_list_waiting");
    call.mockRestore();
  });

  it("opens that agency's Do Something from its row and keeps it open", async () => {
    at("/agencies", [lab, farmers, riders]);
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(riders.name) }));
    expect(await screen.findByRole("heading", { name: "Do Something" })).toBeInTheDocument();
    expect(openAgencyId()).toBe(riders.id);
  });

  it("opens the agency named in the route", async () => {
    at(`/a/${farmers.id}`, [farmers, riders]);
    expect(await screen.findByRole("heading", { name: "Do Something" })).toBeInTheDocument();
    expect(openAgencyId()).toBe(farmers.id);
  });

  it("sends a member of exactly one agency straight to its Do Something", async () => {
    at("/agencies", [farmers]);
    expect(await screen.findByRole("heading", { name: "Do Something" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: words.agenciesTitle })).not.toBeInTheDocument();
    expect(openAgencyId()).toBe(farmers.id);
  });

  it("still lists a member of none", async () => {
    at("/agencies", []);
    expect(await screen.findByText(words.agenciesEmptyTitle)).toBeInTheDocument();
  });

  it("keeps the list when a count cannot be read", async () => {
    provideEntryClient(client([lab, farmers]));
    provideWaitingCount(async () => Promise.reject(new Error("down")));
    render(
      <MemoryRouter initialEntries={["/agencies"]}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText(farmers.name)).toBeInTheDocument();
    expect(screen.queryByText(/forms? waiting/)).not.toBeInTheDocument();
  });
});

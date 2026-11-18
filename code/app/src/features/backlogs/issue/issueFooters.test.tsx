import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../../../shared/wakala/openAgency";
import { IssuePage } from "./IssuePage";
import type { CapsClient, CapsReading } from "../caps/api";
import type { ReferencesClient } from "../references/api";
import type { SendClient } from "../send/types";
import type { TodosClient } from "../todos/api";
import type { BacklogsClient, Issue, IssueDetail, NotesClient } from "../shared/api";

const base: Issue = { id: "1", code: "SW9", title: "SW9 Write the manual", description: "Body.", status: "pending", step: "To do", repo: "hub-steward", topics: [], backlog: "Backlog", backlogId: "b1", mark: "Ready", rank: 1, priority: "medium", effort: "low" };

const notes: NotesClient = { notes: async () => [], addNote: async () => Promise.reject(new Error("unused")) };

const caps = { input: 1, output: 1, runtimeSeconds: 60 };

const reading: CapsReading = { inForce: caps, standard: caps, own: null, used: { input: 0, output: 0, seconds: 0, clockStopped: false } };

const capsClient: CapsClient = { read: async () => reading, nearest: async () => ({}), set: async () => reading, clear: async () => reading };

const referencesClient: ReferencesClient = { list: async () => [], confirm: async () => undefined, remove: async () => undefined, findIssue: async () => null } as unknown as ReferencesClient;

const sendClient: SendClient = { targets: async () => [{ backlogId: "b1", name: "Backlog", stepId: "s1", stepName: "To do" }, { backlogId: "b2", name: "Documentation", stepId: "d1", stepName: "Draft" }], send: async () => ({ sent: 1, refusal: "" }) };

const todosClient = { list: async () => [], add: async () => undefined, rename: async () => undefined, setWaitsOn: async () => undefined, setStatus: async () => undefined, block: async () => undefined, remove: async () => undefined, reorder: async () => undefined } as unknown as TodosClient;

const page = () => {
  const detail: IssueDetail = { ...base, waitsOn: [], waitedOnBy: [] };
  const client: BacklogsClient = { backlogs: async () => [], issues: async () => [], issue: async () => detail, setPriority: async () => undefined, setEffort: async () => undefined };
  render(
    <MemoryRouter initialEntries={["/a/hub-1/backlogs/issue/1"]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/issue/:issueId" element={<IssuePage client={client} notesClient={notes} todosClient={todosClient} capsClient={capsClient} referencesClient={referencesClient} sendClient={sendClient} />} />
      </Routes>
    </MemoryRouter>,
  );
};

const cardTitled = async (title: string) => (await screen.findByText(title, { selector: ".card-title, .card-title *" })).closest(".card") as HTMLElement;

const footOf = (card: HTMLElement) => card.querySelector(":scope > .card-foot") as HTMLElement;

beforeEach(() => openAgency({ id: "hub-1", name: "Hub" } as never));
afterEach(() => vi.restoreAllMocks());

describe("every act of the issue page sits in the footer of its card, two items at most", () => {
  it("has Add a piece in the footer of the Todo list card and no loose row", async () => {
    page();
    const card = await cardTitled("Todo list");
    expect(await within(card).findByRole("button", { name: "Add a piece" })).toBe(within(footOf(card)).getByRole("button", { name: "Add a piece" }));
    expect(screen.queryByText("+ Add a piece")).toBeNull();
  });

  it("opens the piece form from that footer and gives Add and Cancel inside the form", async () => {
    page();
    const card = await cardTitled("Todo list");
    await userEvent.click(await within(card).findByRole("button", { name: "Add a piece" }));
    expect(within(card).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("has Add a reference in the footer of the References card", async () => {
    page();
    const card = await cardTitled("References");
    await userEvent.click(within(card).getByRole("button", { name: /References/ }));
    expect(within(footOf(card)).getByRole("link", { name: "Add a reference" })).toBeInTheDocument();
    expect(card.querySelector(":scope > .card-body .ref-add")).toBeNull();
  });

  it("has Edit in the footer of the Caps card", async () => {
    page();
    const card = await cardTitled("Caps");
    await userEvent.click(within(card).getByRole("button", { name: /Caps/ }));
    expect(await within(footOf(card)).findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(card.querySelector(":scope > .card-body .cap-actions")).toBeNull();
  });

  it("has Add a note in the footer of the Log card, and Cancel with Add once it is open", async () => {
    page();
    const card = await cardTitled("Log");
    await userEvent.click(within(card).getByRole("button", { name: /Log/ }));
    await userEvent.click(within(footOf(card)).getByRole("button", { name: "Add a note" }));
    const foot = footOf(card);
    expect(within(foot).getAllByRole("button").map((one) => one.textContent)).toEqual(["Cancel", "Add"]);
    expect(within(card).getByLabelText("Add a note")).toBeInTheDocument();
  });

  it("has Send to backlog in the footer of the Backlog card, over the place the issue is in", async () => {
    page();
    const card = await cardTitled("Backlog");
    expect(within(card).getByText("Backlog · To do")).toBeInTheDocument();
    expect(within(footOf(card)).getByRole("button", { name: "Send to backlog" })).toBeInTheDocument();
  });

  it("keeps every footer to two items at most", async () => {
    page();
    await cardTitled("Backlog");
    document.querySelectorAll(".card-foot").forEach((foot) => expect(foot.children.length).toBeLessThanOrEqual(2));
  });

  it("uses the full width of the page column on a wide screen", async () => {
    page();
    await screen.findByRole("heading", { level: 1, name: "Write the manual" });
    expect(document.querySelector(".person-page")).toHaveClass("wide");
  });
});

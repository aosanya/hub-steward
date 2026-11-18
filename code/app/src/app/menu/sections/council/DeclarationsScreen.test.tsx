import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { stepsPaths } from "../../../../features/steps/routePaths";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { councilPaths } from "./paths";
import { DeclarationsScreen, declarationsTitle } from "./DeclarationsScreen";
import { dayWords } from "../../../../shared/ui/days";
import { items } from "./index";

const tool = "agency_list_declarations";

const officeQuestion = "Do you hold an office in a company that bids for town contracts?";
const relativesQuestion = "Which relatives work for the town?";
const gardenQuestion = "Do you own land beside the Lake Garden?";

const zsofia = { row_id: "d1", actor_id: "a1", name: "Zsofia Varga", declared_on: "2026-03-02", answers: { [officeQuestion]: "No", [relativesQuestion]: "None", [gardenQuestion]: "Yes, one plot" }, own: false };
const bence = { row_id: "d2", actor_id: "a2", name: "Bence Kovacs", declared_on: "2026-03-05", answers: { [officeQuestion]: "Yes, the reed-cutting cooperative", [relativesQuestion]: "A cousin at the depot" }, own: true };
const ilona = { actor_id: "a3", name: "Ilona Farkas" };
const tamas = { actor_id: "a4", name: "Tamas Nagy" };

const readerReply = { declared: [zsofia, bence], not_declared: [ilona, tamas], not_declared_count: 2, total: 4, can_read_all: true };

const memberReply = { declared: [bence], not_declared: [], not_declared_count: 0, total: 4, can_read_all: false };

const nobodyReply = { declared: [], not_declared: [], not_declared_count: 0, total: 4, can_read_all: false };

const declarationStep = { id: "s9", kind: "fill_form", state: "start", title: "Declaration of interest", form_name: "Declaration of interest", role_name: "Councillor", workflow_name: "Declarations", questions: [{ prompt: officeQuestion, answer_type: "free_text" }] };

let called: MockInstance<typeof mcp.callTool>;
let landed = "";
let reply: unknown = readerReply;
let openSteps: unknown[] = [];

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

const answer = (name: string) => {
  if (name === tool) return Promise.resolve(reply);
  if (name === "agency_list_my_open_steps") return Promise.resolve({ items: openSteps });
  if (name === "agency_list_my_sent_steps") return Promise.resolve({ items: [] });
  return Promise.reject(new Error(`${name}: unknown tool`));
};

beforeEach(() => {
  reply = readerReply;
  openSteps = [];
  openAgency("town");
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => answer(name));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  Reflect.deleteProperty(window, "matchMedia");
  vi.restoreAllMocks();
});

const showDeclarations = () =>
  render(
    <MemoryRouter initialEntries={[councilPaths.declarations.path()]}>
      <Routes>
        <Route path={councilPaths.declarations.pattern} element={<DeclarationsScreen />} />
        <Route path={stepsPaths.step.pattern} element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const pane = () => document.querySelector(".mw-detail") as HTMLElement | null;

const rowOf = (name: string) => screen.getByText(name, { selector: ".ttl" }).closest(".row") as HTMLElement;

const metaOf = (row: HTMLElement) => Array.from(row.querySelectorAll(".meta")).map((line) => line.textContent);

describe("the Declarations of interest row", () => {
  it("is titled Declarations of interest", () => {
    expect(declarationsTitle).toBe("Declarations of interest");
  });

  it("is the last row of the Council list and opens the declarations path", () => {
    const row = items.find((item) => item.title === "Declarations of interest");

    expect(items[items.length - 1]).toBe(row);
    expect(row?.path()).toBe(councilPaths.declarations.path());
    expect(councilPaths.declarations.path()).toMatch(/^\/a\/[^/]+\/menu\/council\/declarations$/);
  });
});

describe.each([
  ["phone", false],
  ["wide", true],
])("the Declarations of interest screen on a %s", (_name, wide) => {
  beforeEach(() => setWide(wide));

  it("lists one row per declared member with the date declared", async () => {
    showDeclarations();

    await screen.findByText("Zsofia Varga", { selector: ".ttl" });
    expect(screen.getByRole("heading", { name: "Declarations of interest" })).toBeInTheDocument();
    expect(metaOf(rowOf("Zsofia Varga"))).toEqual([dayWords("2026-03-02")]);
    expect(metaOf(rowOf("Bence Kovacs"))).toEqual([dayWords("2026-03-05")]);
    expect(screen.queryByText("Ilona Farkas", { selector: ".row .ttl" })).not.toBeNull();
    expect(called.mock.calls.filter(([, name]) => name === tool).length).toBeGreaterThan(0);
  });

  it("opens the declaration with the member, the date and every answer in the order given", async () => {
    showDeclarations();
    await userEvent.click(await screen.findByRole("button", { name: /Zsofia Varga/ }));

    await waitFor(() => expect(pane()?.textContent).toContain("Yes, one plot"));
    const shown = pane()?.textContent ?? "";
    expect(shown).toContain("Member");
    expect(shown).toContain("Zsofia Varga");
    expect(shown).toContain("Declared on");
    expect(shown).toContain(dayWords("2026-03-02"));
    const at = [officeQuestion, "No", relativesQuestion, "None", gardenQuestion, "Yes, one plot"].map((part) => shown.indexOf(part, shown.indexOf("Declared on")));
    expect(at.every((place) => place > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(screen.getByRole("button", { name: /Zsofia Varga/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the second declaration after choosing it", async () => {
    showDeclarations();
    await userEvent.click(await screen.findByRole("button", { name: /Bence Kovacs/ }));

    await waitFor(() => expect(pane()?.textContent).toContain("Yes, the reed-cutting cooperative"));
    expect(pane()?.textContent).not.toContain("Yes, one plot");
  });

  it("shows Not yet declared with the count in the heading and the names, to a reader of all declarations", async () => {
    showDeclarations();

    const heading = await screen.findByRole("heading", { name: "Not yet declared (2)" });
    const section = heading.parentElement as HTMLElement;
    expect(within(section).getByText("Ilona Farkas")).toBeInTheDocument();
    expect(within(section).getByText("Tamas Nagy")).toBeInTheDocument();
  });

  it("leaves Not yet declared out when the person may not read everyone's declarations", async () => {
    reply = memberReply;
    showDeclarations();

    await screen.findByText("Bence Kovacs", { selector: ".ttl" });
    expect(screen.queryByText(/Not yet declared/)).toBeNull();
  });

  it("leaves Not yet declared out when the server withholds it even with names present", async () => {
    reply = { ...readerReply, can_read_all: false };
    showDeclarations();

    await screen.findByText("Zsofia Varga", { selector: ".ttl" });
    expect(screen.queryByText(/Not yet declared/)).toBeNull();
    expect(screen.queryByText("Ilona Farkas")).toBeNull();
  });

  it("leaves Not yet declared out when everyone has declared", async () => {
    reply = { ...readerReply, not_declared: [], not_declared_count: 0 };
    showDeclarations();

    await screen.findByText("Zsofia Varga", { selector: ".ttl" });
    expect(screen.queryByText(/Not yet declared/)).toBeNull();
  });

  it("carries a Declare button in the empty card for a member with an open declaration step, and opens that step", async () => {
    reply = nobodyReply;
    openSteps = [declarationStep];
    showDeclarations();

    expect(await screen.findByText("You have not declared.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Declare" }));

    await waitFor(() => expect(landed).toBe("/a/town/steps/s9"));
  });

  it("falls back to a Home button in the empty card when the person has no declaration step", async () => {
    reply = nobodyReply;
    openSteps = [{ ...declarationStep, id: "s1", title: "Report a broken lamp", form_name: "Broken lamp", workflow_name: "Repairs" }];
    showDeclarations();

    expect(await screen.findByText("No declarations yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Declare" })).toBeNull();
  });
});

const stamp = "2026-11-18T22:11:08.761949000Z";

const stamped = { row_id: "d5", actor_id: "a5", name: "Aranka Zoldhalmi", declared_on: stamp, answers: { [officeQuestion]: "No" }, own: false };

const noNameYet = { row_id: "d6", actor_id: "a6", name: "", declared_on: "2026-03-09", answers: { [officeQuestion]: "No" }, own: false };

const idAsName = { row_id: "d7", actor_id: "a7", name: "3f2c9a1e-5b7d-4c8e-9a10-2b6d4e8f0a13", declared_on: "2026-03-10", answers: { [officeQuestion]: "No" }, own: false };

const unnamedWords = "Unnamed person";

describe.each([
  ["phone", false],
  ["wide", true],
])("the Declarations of interest screen on a %s reads like a person wrote it", (_name, wide) => {
  beforeEach(() => setWide(wide));

  it("shows a timestamp as a day in the list and in the opened declaration, never the raw stamp", async () => {
    reply = { ...readerReply, declared: [stamped] };
    showDeclarations();

    await screen.findByText("Aranka Zoldhalmi", { selector: ".ttl" });
    expect(metaOf(rowOf("Aranka Zoldhalmi"))).toEqual([dayWords(stamp)]);
    expect(dayWords(stamp)).toBe("Wednesday, 18 Nov");
    await userEvent.click(screen.getByRole("button", { name: /Aranka Zoldhalmi/ }));
    await waitFor(() => expect(pane()?.textContent).toContain("Declared on"));
    expect(pane()?.textContent).toContain(dayWords(stamp));
    expect(document.body.textContent).not.toContain("T22:11");
    expect(document.body.textContent).not.toContain("761949");
  });

  it("names a declared member with an empty name or an id for a name Unnamed person, never an id", async () => {
    reply = { ...readerReply, declared: [noNameYet, idAsName] };
    showDeclarations();

    await waitFor(() => expect(screen.getAllByText(unnamedWords, { selector: ".ttl" })).toHaveLength(2));
    expect(document.body.textContent).not.toContain("3f2c9a1e");
  });

  it("names a not yet declared member with an empty name or an id for a name Unnamed person", async () => {
    reply = { ...readerReply, not_declared: [{ actor_id: "a8", name: "" }, { actor_id: "a9", name: "9d41b7c2-0e5a-4f63-8b2c-1a7e6d3f5c90" }, tamas], not_declared_count: 3 };
    showDeclarations();

    const heading = await screen.findByRole("heading", { name: "Not yet declared (3)" });
    const section = heading.parentElement as HTMLElement;
    expect(within(section).getAllByText(unnamedWords)).toHaveLength(2);
    expect(within(section).getByText("Tamas Nagy")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("9d41b7c2");
  });

  it("names the member of an opened declaration with no name Unnamed person", async () => {
    reply = { ...readerReply, declared: [noNameYet] };
    showDeclarations();
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(unnamedWords) }));

    await waitFor(() => expect(pane()?.textContent).toContain("Member"));
    expect(pane()?.textContent).toContain(unnamedWords);
  });
});

describe("the Declarations of interest screen on a computer", () => {
  beforeEach(() => setWide(true));

  it("opens the first declaration beside the list without a click", async () => {
    showDeclarations();

    await waitFor(() => expect(pane()?.textContent).toContain("Yes, one plot"));
    expect(screen.getByRole("button", { name: /Zsofia Varga/ })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("the Declarations of interest screen on a phone", () => {
  beforeEach(() => setWide(false));

  it("opens no declaration until a row is chosen", async () => {
    showDeclarations();
    await screen.findByText("Zsofia Varga", { selector: ".ttl" });

    expect(pane()).toBeNull();
  });
});

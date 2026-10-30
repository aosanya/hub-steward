import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answerWith, callsOf, renderPage } from "../spec/profileTesting";
import { ModulesView } from "../views/ModulesView";

vi.mock("../../wakala/mcp");

const module = (over: Record<string, unknown>) => ({
  id: "m1",
  code: "comm",
  name: "Chat",
  description: "Rooms to talk in.",
  locked: false,
  enabled: false,
  explicit: false,
  needed_by_steps: false,
  ...over,
});

const forms = () => module({ id: "m2", code: "forms", name: "Forms", description: "Questions people answer.", enabled: true, explicit: true });

let stored: Record<string, unknown>[] = [];

const open = async (replies: Record<string, unknown> = {}) => {
  answerWith({
    agency_list_modules: () => ({ items: stored }),
    agency_set_module_enabled: (args: Record<string, unknown>) => {
      stored = stored.map((one) => (one.id === args.module_id ? { ...one, enabled: args.enabled, explicit: args.enabled } : one));
      return {};
    },
    agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
    ...replies,
  });
  renderPage(<ModulesView />, "modules");
  await screen.findByRole("button", { name: "Chat" });
};

const rowOf = (name: string) => screen.getByRole("button", { name }).closest(".card") as HTMLElement;

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  stored = [module({}), forms()];
});

describe("the modules page", () => {
  it("has the title, a short note and a card for every module with its description", async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole("button", { name: "Chat" }));
    await user.click(screen.getByRole("button", { name: "Forms" }));

    expect(screen.getByRole("heading", { name: "Modules", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Switch on the modules this agency uses/)).toBeInTheDocument();
    expect(screen.getByText("Rooms to talk in.")).toBeInTheDocument();
    expect(screen.getByText("Questions people answer.")).toBeInTheDocument();
  });

  it("lists the modules by name", async () => {
    stored = [forms(), module({})];
    await open();

    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Chat", "Forms"]);
  });

  it("narrows the modules to those whose name or description has the words typed", async () => {
    const user = userEvent.setup();
    await open();

    await user.type(screen.getByRole("searchbox", { name: "Search modules" }), "questions");
    expect(screen.queryByRole("button", { name: "Chat" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forms" })).toBeInTheDocument();
  });

  it("says On or Off for a free module and switches it by the toggle", async () => {
    await open();

    expect(within(rowOf("Chat")).getByText("Off")).toBeInTheDocument();
    expect(within(rowOf("Forms")).getByText("On")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Chat" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Forms" })).toBeChecked();
  });

  it("writes a switch straight into the working draft and reloads the list", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(screen.getByRole("switch", { name: "Chat" }));

    await waitFor(() => expect(screen.getByRole("switch", { name: "Chat" })).toBeChecked());
    expect(callsOf("agency_set_module_enabled")).toEqual([{ draft_id: "d1", module_id: "m1", enabled: true }]);
    expect(callsOf("agency_list_modules")).toHaveLength(2);
    expect(callsOf("agency_propose_write")).toHaveLength(0);
    expect(within(rowOf("Chat")).getByText("On")).toBeInTheDocument();
  });

  it("switches a module off the same way", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(screen.getByRole("switch", { name: "Forms" }));

    await waitFor(() => expect(screen.getByRole("switch", { name: "Forms" })).not.toBeChecked());
    expect(callsOf("agency_set_module_enabled")).toEqual([{ draft_id: "d1", module_id: "m2", enabled: false }]);
  });

  it("shows a locked module on and disabled with an Always on chip", async () => {
    stored = [module({ locked: true, enabled: true, explicit: true })];
    await open();

    expect(screen.getByRole("switch", { name: "Chat" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Chat" })).toBeDisabled();
    expect(within(rowOf("Chat")).getByText("Always on")).toBeInTheDocument();
  });

  it("shows a module a workflow step needs on and disabled with its own chip", async () => {
    stored = [module({ enabled: true, explicit: false, needed_by_steps: true })];
    await open();

    expect(screen.getByRole("switch", { name: "Chat" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Chat" })).toBeDisabled();
    expect(within(rowOf("Chat")).getByText("Needed by a workflow step")).toBeInTheDocument();
  });

  it("shows a module another module requires on and disabled with its own chip", async () => {
    stored = [module({ enabled: true, explicit: false, needed_by_steps: false })];
    await open();

    expect(screen.getByRole("switch", { name: "Chat" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Chat" })).toBeDisabled();
    expect(within(rowOf("Chat")).getByText("Needed by another module")).toBeInTheDocument();
  });

  it("leaves a module free to switch when it was also switched on by hand", async () => {
    stored = [module({ enabled: true, explicit: true, needed_by_steps: true })];
    await open();

    expect(screen.getByRole("switch", { name: "Chat" })).toBeEnabled();
    expect(within(rowOf("Chat")).getByText("On")).toBeInTheDocument();
  });

  it("says why when a switch is refused and leaves the switch as it was", async () => {
    const user = userEvent.setup();
    await open({
      agency_set_module_enabled: () => {
        throw new Error("a locked module cannot be switched off");
      },
    });

    await user.click(screen.getByRole("switch", { name: "Chat" }));

    const said = await screen.findByText("a locked module cannot be switched off");
    expect(said).toHaveClass("error");
    expect(screen.getByRole("switch", { name: "Chat" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Chat" })).toBeEnabled();
  });

  it("says the page could not be loaded when the modules cannot be read, keeping the title", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("offline"));
    renderPage(<ModulesView />, "modules");

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
    expect(screen.getByRole("heading", { name: "Modules", level: 1 })).toBeInTheDocument();
  });
});

describe("the modules page module", () => {
  it("lists the modules as rows", async () => {
    stored = [module({}), forms()];
    answerWith({ agency_list_modules: () => ({ items: stored }), agency_list_drafts: { items: [] } });
    const { modulesPage } = await import("./modulesModule");

    expect(await modulesPage.rows("h1", {})).toEqual([
      { id: "m1", name: "Chat", description: "Rooms to talk in." },
      { id: "m2", name: "Forms", description: "Questions people answer." },
    ]);
  });
});

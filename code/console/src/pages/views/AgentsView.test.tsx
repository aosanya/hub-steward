import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { agentsPage, createAgentForSeat } from "../../data/pages/agents";
import { I18nProvider } from "../../i18n";
import { ConsoleCtx, type ConsoleContext } from "../../shell/context";
import type { PageRow } from "../../types";
import { AgentsView } from "./AgentsView";

vi.mock("../../data/pages/agents", async (original) => {
  const actual = await original<typeof import("../../data/pages/agents")>();
  return { ...actual, agentsPage: { ...actual.agentsPage, rows: vi.fn() }, createAgentForSeat: vi.fn() };
});

const english = {
  en: {
    "menu.agents": "Agents",
    agentModel: "Model",
    "agents.worksFor": "Works for",
    "agents.colState": "State",
    "agents.configure": "Configure",
    "agents.search": "Search agents",
    "agents.noModelKey": "No model key",
    "agents.state.running": "Running",
    "agents.state.skipped": "Skipped: no model key",
    "agents.state.stopped": "Stopped",
    "agents.state.cannotSpeak": "Cannot speak",
    "agents.state.noModel": "No model",
    loadFailed: "The page could not be loaded.",
    noRows: "Nothing here yet.",
  },
};

const consoleValue: ConsoleContext = {
  hub: { id: "h1", name: "Siaya Boda Boda Riders", role: "owner" },
  page: "agents",
  setBadges: () => {},
  refreshMenu: () => {},
};

const running: PageRow = {
  id: "a1",
  name: "Hub Steward",
  works_for: "Members and the manager",
  model: "Sonnet 5.5",
  state: "Running",
  edit: "agent-edit",
};

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

const open = (rows: PageRow[] | Error) => {
  vi.mocked(agentsPage.rows).mockReset();
  if (rows instanceof Error) vi.mocked(agentsPage.rows).mockRejectedValue(rows);
  else vi.mocked(agentsPage.rows).mockResolvedValue(rows);
  render(
    <I18nProvider initial={english}>
      <MemoryRouter>
        <ConsoleCtx.Provider value={consoleValue}>
          <AgentsView />
          <Where />
        </ConsoleCtx.Provider>
      </MemoryRouter>
    </I18nProvider>,
  );
};

const titles = () => Array.from(document.querySelectorAll(".card-toggle")).map((button) => button.textContent);

const cardOf = async (name: string) => {
  const toggle = await screen.findByRole("button", { name });
  await userEvent.click(toggle);
  return within(toggle.closest(".card") as HTMLElement);
};

describe("the Agents page", () => {
  it("is titled Agents with no button beside the title, and reads the agents of the open hub", async () => {
    open([running]);
    expect(await screen.findByRole("heading", { level: 1, name: "Agents" })).toBeInTheDocument();
    expect(document.querySelector(".top button")).toBeNull();
    expect(agentsPage.rows).toHaveBeenCalledWith("h1", {});
  });

  it("shows an agent as a collapsed card that holds what it works for, its model, its state, and a Configure link", async () => {
    open([running]);
    await screen.findByRole("button", { name: "Hub Steward" });
    expect(screen.queryByText("Members and the manager")).not.toBeInTheDocument();
    const card = await cardOf("Hub Steward");
    expect(card.getByText("Works for").nextElementSibling).toHaveTextContent("Members and the manager");
    expect(card.getByText("Sonnet 5.5")).toHaveClass("tag", "mute");
    expect(card.getByText("Running")).toHaveClass("tag", "ok");
    expect(card.getByRole("link", { name: "Configure" })).toHaveAttribute("href", "/h/h1/agent-edit/a1/model");
  });

  it("links the model to the Models page", async () => {
    open([running]);
    await cardOf("Hub Steward");
    expect((await screen.findByText("Sonnet 5.5")).closest("a")).toHaveAttribute("href", "/h/h1/models");
  });

  it("says Skipped: no model key in a warning chip that opens Models when the hub has no key", async () => {
    open([{ ...running, state: "Skipped", link: "models" }]);
    await cardOf("Hub Steward");
    const chip = await screen.findByText("Skipped: no model key");
    expect(chip).toHaveClass("tag", "warn");
    expect(chip.closest("a")).toHaveAttribute("href", "/h/h1/models");
  });

  it("says No model key for an agent that has no model and Cannot speak as its state", async () => {
    open([{ ...running, model: "Choose a model", state: "Cannot speak" }]);
    const card = await cardOf("Hub Steward");
    expect(card.getByText("No model key")).toHaveClass("tag", "mute");
    expect(card.getByText("Cannot speak")).toHaveClass("tag", "warn");
  });

  it("says Stopped in a quiet chip for an agent that is switched off, beside its model", async () => {
    open([{ ...running, name: "Dispatcher", state: "Stopped" }]);
    const card = await cardOf("Dispatcher");
    expect(card.getByText("Stopped")).toHaveClass("tag", "mute");
    expect(card.getByText("Sonnet 5.5")).toHaveClass("tag", "mute");
  });

  it("says No model key beside Running for an agent that needs no model", async () => {
    open([{ ...running, name: "Network Watcher", model: "", state: "Running" }]);
    const card = await cardOf("Network Watcher");
    expect(card.getByText("No model key")).toHaveClass("tag", "mute");
    expect(card.getByText("Running")).toHaveClass("tag", "ok");
    expect(card.queryByText("Cannot speak")).not.toBeInTheDocument();
  });

  it("shows a state it does not know in its own words, as a quiet chip", async () => {
    open([{ ...running, state: "Waiting" }]);
    await cardOf("Hub Steward");
    expect(await screen.findByText("Waiting")).toHaveClass("tag", "mute");
  });

  it("lists the agency's AI roles that have no AI role yet with No model, without a link to configure", async () => {
    open([{ id: "r2", name: "Matching agent", works_for: "Matches riders", model: "Choose a model", state: "No model" }]);
    const card = await cardOf("Matching agent");
    expect(card.getByText("No model")).toHaveClass("tag", "mute");
    expect(card.getByText("No model key")).toBeInTheDocument();
    expect(card.queryByRole("link", { name: "Configure" })).not.toBeInTheDocument();
  });

  it("lists the agents in the order of their names", async () => {
    open([
      { ...running, id: "a2", name: "Network Watcher" },
      { ...running, id: "a3", name: "Dispatcher" },
      running,
    ]);
    await screen.findByText("Hub Steward");
    expect(titles()).toEqual(["Dispatcher", "Hub Steward", "Network Watcher"]);
  });

  it("keeps the agents whose name or work has the words typed", async () => {
    open([{ ...running, id: "a2", name: "Dispatcher", works_for: "Riders" }, running]);
    await screen.findByText("Dispatcher");
    await userEvent.setup().type(screen.getByRole("searchbox", { name: "Search agents" }), "riders");
    expect(titles()).toEqual(["Dispatcher"]);
    expect(screen.queryByText("Hub Steward")).not.toBeInTheDocument();
  });

  it("says nothing is here yet when the hub has no agents", async () => {
    open([]);
    expect((await screen.findByText("Nothing here yet.")).closest(".empty")).not.toBeNull();
  });

  it("shows the title and says the page could not be loaded when the agents cannot be read", async () => {
    open(new Error("boom"));
    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("empty", "error");
    expect(screen.getByRole("heading", { level: 1, name: "Agents" })).toBeInTheDocument();
  });

  it("makes the agent of an agent role the first time Configure is pressed and opens its edit page", async () => {
    vi.mocked(createAgentForSeat).mockResolvedValue("a5");
    open([{ seat_id: "s2", name: "Farmers' agent", description: "Answers farmers", works_for: "Farmers' agent", model: "Choose a model", state: "Cannot speak" }]);
    const card = await cardOf("Farmers' agent");
    await userEvent.click(card.getByRole("button", { name: "Configure" }));
    expect(createAgentForSeat).toHaveBeenCalledWith("h1", "s2", "Farmers' agent", "Answers farmers");
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/h/h1/agent-edit/a5/model"));
  });
});

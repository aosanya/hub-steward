import { screen, within } from "@testing-library/react";
import { accountUsers, type AccountUser } from "../../data/accounts";
import type { ModelAccount } from "../../data/modelLimits";
import type { Hub } from "../../types";
import { glm, openModel, sonnet, staff } from "../limits/harness";

vi.mock("../../data/accounts", async (original) => {
  const actual = await original<typeof import("../../data/accounts")>();
  return { ...actual, accountUsers: vi.fn(), listAccounts: vi.fn() };
});

vi.mock("../../data/modelLimits", async (original) => {
  const actual = await original<typeof import("../../data/modelLimits")>();
  return { ...actual, modelAccounts: vi.fn() };
});

const dispatcher: AccountUser = { id: "r1", name: "Dispatcher", description: "Riders and customers" };
const keeper: AccountUser = { id: "r 2", name: "Assets Keeper", description: "The manager and members" };

const open = async (models: ModelAccount[] | Error, users: AccountUser[] | Error = [dispatcher, keeper], hub?: Hub) => {
  vi.mocked(accountUsers).mockReset();
  if (users instanceof Error) vi.mocked(accountUsers).mockRejectedValue(users);
  else vi.mocked(accountUsers).mockResolvedValue(users);
  await openModel(models, "users", hub);
};

const tabLabels = () => Array.from(document.querySelectorAll(".tab")).map((tab) => tab.textContent);

describe("the Users tab of a model", () => {
  it("is titled with the provider and the model, reads the users of that model, and marks Users", async () => {
    await open([glm]);
    expect(screen.getByRole("heading", { level: 1, name: "Hugging Face · GLM-5.3" })).toBeInTheDocument();
    expect(screen.getByText("Users", { selector: ".tab" })).toHaveAttribute("aria-current", "page");
    expect(accountUsers).toHaveBeenCalledWith("h1", glm.id);
  });

  it("draws one row for each agent that uses the model, with who it works for under its name", async () => {
    await open([glm]);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getByText(/Dispatcher|Assets Keeper/).textContent)).toEqual(["Dispatcher", "Assets Keeper"]);
    expect(within(rows[0]).getByText("Riders and customers")).toHaveClass("cell-sub");
    expect(within(rows[1]).getByText("The manager and members")).toHaveClass("cell-sub");
  });

  it("links the Edit of each agent to the model tab of that agent's page", async () => {
    await open([glm]);
    const [first, second] = screen.getAllByRole("row").slice(1);
    expect(within(first).getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/h/h1/agent-edit/r1/model");
    expect(within(second).getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/h/h1/agent-edit/r%202/model");
  });

  it("links the name of an agent to the same page", async () => {
    await open([glm]);
    expect(screen.getByRole("link", { name: "Dispatcher" })).toHaveAttribute("href", "/h/h1/agent-edit/r1/model");
  });

  it("draws a card with a sentence and an Open Agents button inside it when no agent uses the model", async () => {
    await open([glm], []);
    const card = screen.getByText("No agent uses this model yet.").closest(".empty") as HTMLElement;
    expect(card).not.toHaveClass("error");
    expect(within(card).getByRole("link", { name: "Open Agents" })).toHaveAttribute("href", "/h/h1/agents");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says the page could not be loaded under the tabs when the users cannot be read", async () => {
    await open([glm], new Error('unknown tool "ai_list_roles"'));
    expect(screen.getByText("The page could not be loaded.")).toHaveClass("empty", "error");
    expect(screen.getByRole("heading", { level: 1, name: "Hugging Face · GLM-5.3" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Limits" })).toBeInTheDocument();
  });

  it("says the page could not be loaded when the models cannot be listed", async () => {
    await open(new Error('unknown tool "ai_list_accounts"'));
    expect(screen.getByText("The page could not be loaded.").closest(".empty")).toHaveClass("error");
    expect(accountUsers).not.toHaveBeenCalled();
  });

  it("keeps a staff seat on the page, with a Staff seat chip and no Key and test tab", async () => {
    await open([glm], [dispatcher], staff);
    expect(screen.getByText("Staff seat")).toHaveClass("tag", "mute");
    expect(tabLabels()).toEqual(["Limits", "Users", "Usage"]);
    expect(screen.getByText("Dispatcher")).toBeInTheDocument();
  });
});

describe("the Users tab for a hub with several models", () => {
  it("draws the users of the model in the address only", async () => {
    vi.mocked(accountUsers).mockReset();
    vi.mocked(accountUsers).mockImplementation(async (_hub, id) => (id === glm.id ? [dispatcher, keeper] : []));
    await openModel([glm, sonnet], "users", undefined, sonnet.id);
    expect(screen.getByRole("heading", { level: 1, name: "Claude · Sonnet 5.5" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(accountUsers).toHaveBeenCalledTimes(1);
    expect(accountUsers).toHaveBeenCalledWith("h1", sonnet.id);
    expect(screen.getByText("No agent uses this model yet.")).toBeInTheDocument();
    expect(screen.queryByText("Dispatcher")).not.toBeInTheDocument();
  });

  it("draws the users of the first model when its own address is opened", async () => {
    vi.mocked(accountUsers).mockReset();
    vi.mocked(accountUsers).mockImplementation(async (_hub, id) => (id === glm.id ? [dispatcher, keeper] : []));
    await openModel([glm, sonnet], "users", undefined, glm.id);
    expect(screen.getByRole("heading", { level: 1, name: "Hugging Face · GLM-5.3" })).toBeInTheDocument();
    expect(accountUsers).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });
});

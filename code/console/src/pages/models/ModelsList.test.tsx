import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { accountUsers, deleteAccount, ensureDefaultAccount, listAccounts } from "../../data/accounts";
import { ModelsList } from "./ModelsList";
import { agentNamed, glm, renderOnStage, settle, sonnet, stubAccounts } from "./listTesting";
import { currentAddress } from "./locationSpy";

vi.mock("../../data/accounts");

const showList = async () => {
  const view = renderOnStage(<ModelsList />);
  await settle();
  return view;
};

const hubCards = () => Array.from(document.querySelectorAll<HTMLElement>(".card")).filter((card) => card.querySelector(".card-toggle"));

const titles = () => hubCards().map((card) => card.querySelector(".card-toggle")?.textContent);

const hubRow = async (name: string) => {
  const card = hubCards().find((candidate) => candidate.querySelector(".card-toggle")?.textContent === name) as HTMLElement;
  if (!card.querySelector(".detail, dl")) await userEvent.click(within(card).getByRole("button", { name }));
  return card;
};

const availableRow = (modelId: string) => screen.getByText(modelId).closest("tr") as HTMLElement;

afterEach(() => {
  vi.clearAllMocks();
});

describe("the hub's models", () => {
  it("lists one card per account with its provider chip, model id and key state", async () => {
    stubAccounts({ accounts: [glm, sonnet] });
    await showList();

    expect(hubCards()).toHaveLength(2);
    const first = await hubRow("GLM-5.3");
    expect(within(first).getByText("Hugging Face")).toBeInTheDocument();
    expect(within(first).getByText("zai-org/GLM-5.3:novita")).toBeInTheDocument();
    expect(within(first).getByText("set")).toBeInTheDocument();
    const second = await hubRow("Sonnet 5.5");
    expect(within(second).getByText("Claude")).toBeInTheDocument();
    expect(within(second).getByText("claude-sonnet-5-5")).toBeInTheDocument();
    expect(within(second).getByText("No key")).toBeInTheDocument();
    expect(within(first).queryByText("No key")).not.toBeInTheDocument();
  });

  it("lists the accounts by model name", async () => {
    stubAccounts({ accounts: [sonnet, glm] });
    await showList();

    expect(titles()).toEqual(["GLM-5.3", "Sonnet 5.5"]);
  });

  it("narrows the accounts to the ones matching the search", async () => {
    stubAccounts({ accounts: [glm, sonnet] });
    await showList();

    await userEvent.type(screen.getByRole("searchbox", { name: "Search models" }), "sonnet");

    expect(titles()).toEqual(["Sonnet 5.5"]);
  });

  it("draws no provider badge in front of the model names", async () => {
    stubAccounts({ accounts: [glm, sonnet] });
    const { container } = await showList();

    expect(container.querySelector(".badge")).toBeNull();
    expect(container.textContent).not.toMatch(/\b(HF|CL|ME|OT)\b/);
  });

  it("marks the Meta provider with the Meta chip", async () => {
    stubAccounts({ accounts: [{ ...glm, id: "a3", baseUrl: "https://api.meta.ai/v1", modelName: "muse-spark-1.3" }] });
    await showList();

    const row = await hubRow("Muse Spark 1.3");
    expect(within(row).getByText("Meta Model API")).toBeInTheDocument();
    expect(within(row).getByText("Meta")).toBeInTheDocument();
  });

  it("says how many roles use each model and links the count to the Users tab", async () => {
    stubAccounts({
      accounts: [glm, sonnet],
      users: { a1: [agentNamed("Assets Keeper"), agentNamed("Coordinator"), agentNamed("Greeter")], a2: [agentNamed("Hub Steward")] },
    });
    await showList();

    const many = within(await hubRow("GLM-5.3")).getByRole("link", { name: "Used by 3 roles" });
    expect(many).toHaveAttribute("href", "/h/h1/models/a1/users");
    const one = within(await hubRow("Sonnet 5.5")).getByRole("link", { name: "Used by 1 role" });
    expect(one).toHaveAttribute("href", "/h/h1/models/a2/users");
  });

  it("goes to that model's Users tab when the count is followed", async () => {
    stubAccounts({ accounts: [glm, sonnet], users: { a2: [agentNamed("Hub Steward")] } });
    await showList();
    await userEvent.click(within(await hubRow("Sonnet 5.5")).getByRole("link", { name: "Used by 1 role" }));

    expect(currentAddress()).toBe("/h/h1/models/a2/users");
  });

  it("says a model is used by no roles in plain text, not a link", async () => {
    stubAccounts({ accounts: [glm] });
    await showList();

    const row = await hubRow("GLM-5.3");
    expect(within(row).getByText("Used by no roles")).toBeInTheDocument();
    expect(within(row).queryByRole("link", { name: /^Used by/ })).not.toBeInTheDocument();
  });

  it("counts the agents of each account with its own call", async () => {
    stubAccounts({ accounts: [glm, sonnet] });
    await showList();
    await hubRow("GLM-5.3");
    await hubRow("Sonnet 5.5");

    expect(vi.mocked(accountUsers).mock.calls.map((call) => call[1]).sort()).toEqual(["a1", "a2"]);
  });

  it("puts Add a model in the title row once a model is listed, as a link to the Add page", async () => {
    stubAccounts({ accounts: [glm] });
    await showList();

    const links = screen.getAllByRole("link", { name: "Add a model" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/h/h1/models/new");
    expect(screen.queryByRole("button", { name: "Add a model" })).not.toBeInTheDocument();
    expect(screen.queryByText("No model yet. Add one so the hub's agents can reply.")).not.toBeInTheDocument();
    await userEvent.click(links[0]);
    expect(currentAddress()).toBe("/h/h1/models/new");
  });

  it("links each model's Edit link to that model's Key tab", async () => {
    stubAccounts({ accounts: [glm, sonnet] });
    await showList();

    expect(within(await hubRow("GLM-5.3")).getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/h/h1/models/a1/key");
    expect(within(await hubRow("Sonnet 5.5")).getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/h/h1/models/a2/key");
  });

  it("opens a model from its Edit link", async () => {
    stubAccounts({ accounts: [glm, sonnet] });
    await showList();

    await userEvent.click(within(await hubRow("Sonnet 5.5")).getByRole("link", { name: "Edit" }));
    expect(currentAddress()).toBe("/h/h1/models/a2/key");
  });

  it("encodes an account id that is not plain text", async () => {
    stubAccounts({ accounts: [{ ...glm, id: "a/1 b" }] });
    await showList();

    expect(within(await hubRow("GLM-5.3")).getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/h/h1/models/a%2F1%20b/key");
  });
});

describe("the hub's default model", () => {
  it("is settled for the hub's models when the list loads", async () => {
    stubAccounts({ accounts: [glm, sonnet] });
    await showList();

    expect(ensureDefaultAccount).toHaveBeenCalledTimes(1);
    expect(ensureDefaultAccount).toHaveBeenCalledWith("h1", [glm, sonnet]);
  });

  it("lists the models the settling answered, with the default marked", async () => {
    stubAccounts({ accounts: [glm, sonnet] });
    vi.mocked(ensureDefaultAccount).mockResolvedValue([{ ...glm, isDefault: true }, sonnet]);
    await showList();

    expect(hubCards()).toHaveLength(2);
    expect(within(await hubRow("GLM-5.3")).getByText("zai-org/GLM-5.3:novita")).toBeInTheDocument();
  });

  it("still lists the models as they were, with nothing said to be wrong, when the settling fails", async () => {
    stubAccounts({ accounts: [glm, sonnet] });
    vi.mocked(ensureDefaultAccount).mockRejectedValue(new Error("ai_set_default_account: not allowed"));
    await showList();

    expect(hubCards()).toHaveLength(2);
    expect(within(await hubRow("GLM-5.3")).getByText("zai-org/GLM-5.3:novita")).toBeInTheDocument();
    expect(screen.queryByText("The page could not be loaded.")).not.toBeInTheDocument();
    expect(document.querySelector(".notice")).toBeNull();
  });

  it("is settled again from the models left once one is removed", async () => {
    stubAccounts({ accounts: [glm, sonnet] }, { accounts: [sonnet] });
    vi.mocked(deleteAccount).mockResolvedValue(undefined);
    await showList();
    await userEvent.click(within(await hubRow("GLM-5.3")).getByRole("button", { name: "Remove" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove model" }));
    await settle();

    expect(ensureDefaultAccount).toHaveBeenCalledTimes(2);
    expect(ensureDefaultAccount).toHaveBeenLastCalledWith("h1", [sonnet]);
  });
});

describe("a hub with no model", () => {
  it("shows the empty state with the Add a model link inside it and none in the title row", async () => {
    stubAccounts({ accounts: [] });
    await showList();

    const text = screen.getByText("No model yet. Add one so the hub's agents can reply.");
    const card = text.closest(".empty") as HTMLElement;
    const links = screen.getAllByRole("link", { name: "Add a model" });
    expect(links).toHaveLength(1);
    expect(card).toContainElement(links[0]);
    expect(links[0]).toHaveAttribute("href", "/h/h1/models/new");
    expect(screen.getAllByRole("table")).toHaveLength(4);

    await userEvent.click(links[0]);
    expect(currentAddress()).toBe("/h/h1/models/new");
  });
});

describe("Available to add", () => {
  it("lists the catalog by provider and marks the models the hub already has", async () => {
    stubAccounts({ accounts: [glm, sonnet] });
    await showList();

    expect(screen.getByRole("heading", { name: "Available to add" })).toBeInTheDocument();
    const marks = screen.getAllByText("Added");
    expect(marks).toHaveLength(2);
    const marked = marks.map((mark) => mark.closest("tr") as HTMLElement);
    expect(marked[0]).toHaveTextContent("zai-org/GLM-5.3:novita");
    expect(marked[1]).toHaveTextContent("claude-sonnet-5-5");
    marked.forEach((row) => expect(within(row).queryByRole("link")).not.toBeInTheDocument());
    expect(within(availableRow("claude-haiku-5-5")).getByRole("link", { name: "Add" })).toBeInTheDocument();
    expect(screen.getByText("Your host gives the address and the model id")).toBeInTheDocument();
  });

  it("marks nothing as added when the hub has no model", async () => {
    stubAccounts({ accounts: [] });
    await showList();

    expect(screen.queryByText("Added")).not.toBeInTheDocument();
  });

  const startOf = (modelId: string) => {
    const href = within(availableRow(modelId)).getByRole("link", { name: "Add" }).getAttribute("href") as string;
    const url = new URL(href, "http://console");
    return { path: url.pathname, query: Object.fromEntries(url.searchParams) };
  };

  it("links Add on a Meta Model API model to the Add page with that model in the address", async () => {
    stubAccounts({ accounts: [glm] });
    await showList();

    expect(startOf("muse-spark-1.2")).toEqual({
      path: "/h/h1/models/new",
      query: { provider: "meta", model: "muse-spark-1.2", base: "https://api.meta.ai/v1" },
    });
    expect(within(availableRow("muse-spark-1.2")).getByRole("link", { name: "Add" })).toHaveAttribute(
      "href",
      "/h/h1/models/new?provider=meta&model=muse-spark-1.2&base=https%3A%2F%2Fapi.meta.ai%2Fv1",
    );
  });

  it("links Add on a Claude model to the Add page with that model in the address", async () => {
    stubAccounts({ accounts: [glm] });
    await showList();

    expect(startOf("claude-haiku-5-5")).toEqual({
      path: "/h/h1/models/new",
      query: { provider: "claude", model: "claude-haiku-5-5", base: "https://api.anthropic.com/v1" },
    });
  });

  it("links Add on an open-weights model with an empty address", async () => {
    stubAccounts({ accounts: [] });
    await showList();

    expect(startOf("muse-glimmer")).toEqual({
      path: "/h/h1/models/new",
      query: { provider: "meta_open", model: "muse-glimmer", base: "" },
    });
  });

  it("goes to the Add page with the chosen model when Add is followed", async () => {
    stubAccounts({ accounts: [glm] });
    await showList();
    await userEvent.click(within(availableRow("claude-haiku-5-5")).getByRole("link", { name: "Add" }));

    expect(currentAddress()).toBe("/h/h1/models/new?provider=claude&model=claude-haiku-5-5&base=https%3A%2F%2Fapi.anthropic.com%2Fv1");
  });
});

describe("removing a model", () => {
  const ask = async (name: string) => {
    await userEvent.click(within(await hubRow(name)).getByRole("button", { name: "Remove" }));
  };

  it("asks first, in the page, and removes nothing yet", async () => {
    stubAccounts({ accounts: [glm, sonnet] });
    await showList();
    await ask("GLM-5.3");

    expect(screen.getByText("Remove Hugging Face · GLM-5.3? Agents that use it will have no model.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove model" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("keeps the account when the question is cancelled", async () => {
    stubAccounts({ accounts: [glm, sonnet] });
    await showList();
    await ask("Sonnet 5.5");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText(/Agents that use it will have no model/)).not.toBeInTheDocument();
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(hubCards()).toHaveLength(2);
  });

  it("removes the account on confirm, reloads the list and says so", async () => {
    stubAccounts({ accounts: [glm, sonnet] }, { accounts: [sonnet] });
    vi.mocked(deleteAccount).mockResolvedValue(undefined);
    await showList();
    await ask("GLM-5.3");
    await userEvent.click(screen.getByRole("button", { name: "Remove model" }));
    await settle();

    expect(deleteAccount).toHaveBeenCalledWith("h1", "a1");
    expect(listAccounts).toHaveBeenCalledTimes(2);
    expect(titles()).toEqual(["Sonnet 5.5"]);
    expect(screen.getByRole("status")).toHaveTextContent("Hugging Face · GLM-5.3 was removed.");
    expect(screen.queryByText(/Agents that use it will have no model/)).not.toBeInTheDocument();
  });

  it("falls back to the empty state when the last model is removed", async () => {
    stubAccounts({ accounts: [sonnet] }, { accounts: [] });
    vi.mocked(deleteAccount).mockResolvedValue(undefined);
    await showList();
    await ask("Sonnet 5.5");
    await userEvent.click(screen.getByRole("button", { name: "Remove model" }));
    await settle();

    expect(screen.getByText("No model yet. Add one so the hub's agents can reply.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Claude · Sonnet 5.5 was removed.");
  });

  it("keeps the question open and says so when the removal fails", async () => {
    stubAccounts({ accounts: [glm] });
    vi.mocked(deleteAccount).mockRejectedValue(new Error("refused"));
    await showList();
    await ask("GLM-5.3");
    await userEvent.click(screen.getByRole("button", { name: "Remove model" }));
    await settle();

    expect(screen.getByRole("alert")).toHaveTextContent("The model could not be removed.");
    expect(screen.getByRole("button", { name: "Remove model" })).toBeEnabled();
    expect(listAccounts).toHaveBeenCalledTimes(1);
  });
});

describe("a list that cannot be read", () => {
  it("says the page could not be loaded and offers no model to add", async () => {
    vi.mocked(listAccounts).mockRejectedValue(new Error("down"));
    await showList();

    expect(screen.getByText("The page could not be loaded.").closest(".empty")).toHaveClass("error");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add a model" })).not.toBeInTheDocument();
    expect(screen.queryByText("Available to add")).not.toBeInTheDocument();
  });

  it("shows only the title while the list is loading", () => {
    vi.mocked(listAccounts).mockReturnValue(new Promise(() => {}));
    renderOnStage(<ModelsList />);

    expect(screen.getByRole("heading", { name: "Models", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("No model yet. Add one so the hub's agents can reply.")).not.toBeInTheDocument();
  });
});

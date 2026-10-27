import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { deleteAccount, listAccounts } from "../data/accounts";
import { currentAddress } from "./models/locationSpy";
import { glm, renderOnStage, settle, sonnet, stubAccounts } from "./models/listTesting";
import { ModelsPage } from "./ModelsPage";

vi.mock("../data/accounts");

const openPage = async () => {
  renderOnStage(<ModelsPage />);
  await settle();
};

const hubCards = () => Array.from(document.querySelectorAll<HTMLElement>(".card")).filter((card) => card.querySelector(".card-toggle"));

const hubRow = async (name: string) => {
  const card = hubCards().find((candidate) => candidate.querySelector(".card-toggle")?.textContent === name) as HTMLElement;
  await userEvent.click(within(card).getByRole("button", { name }));
  return card;
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("the Models page", () => {
  it("is the list of the hub's models and nothing else", async () => {
    stubAccounts({ accounts: [glm, sonnet] });
    await openPage();

    expect(screen.getByRole("heading", { name: "Models", level: 1 })).toBeInTheDocument();
    expect(hubCards()).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Available to add" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Add a model", level: 1 })).not.toBeInTheDocument();
    expect(currentAddress()).toBe("/h/h1/models");
  });

  it("leaves for the Add page from Add a model, with no model chosen", async () => {
    stubAccounts({ accounts: [glm] });
    await openPage();
    await userEvent.click(screen.getByRole("link", { name: "Add a model" }));

    expect(currentAddress()).toBe("/h/h1/models/new");
  });

  it("leaves for the Add page from the empty state, with no model chosen", async () => {
    stubAccounts({ accounts: [] });
    await openPage();
    await userEvent.click(screen.getByRole("link", { name: "Add a model" }));

    expect(currentAddress()).toBe("/h/h1/models/new");
  });

  it("leaves for the Add page on the model chosen in Available to add", async () => {
    stubAccounts({ accounts: [glm] });
    await openPage();
    const row = screen.getByText("claude-opus-5-5").closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("link", { name: "Add" }));

    expect(currentAddress()).toBe("/h/h1/models/new?provider=claude&model=claude-opus-5-5&base=https%3A%2F%2Fapi.anthropic.com%2Fv1");
  });

  it("leaves for a model's Key tab from its Edit link", async () => {
    stubAccounts({ accounts: [glm, sonnet] });
    await openPage();
    await userEvent.click(within(await hubRow("Sonnet 5.5")).getByRole("link", { name: "Edit" }));

    expect(currentAddress()).toBe("/h/h1/models/a2/key");
  });

  it("leaves for a model's Users tab from the count of its agents", async () => {
    stubAccounts({ accounts: [glm, sonnet], users: { a1: [{ id: "greeter", name: "Greeter", description: "" }] } });
    await openPage();
    await userEvent.click(within(await hubRow("GLM-5.3")).getByRole("link", { name: "Used by 1 role" }));

    expect(currentAddress()).toBe("/h/h1/models/a1/users");
  });

  it("removes a model in place, stays on the list and says so", async () => {
    stubAccounts({ accounts: [glm, sonnet] }, { accounts: [sonnet] });
    vi.mocked(deleteAccount).mockResolvedValue(undefined);
    await openPage();
    await userEvent.click(within(await hubRow("GLM-5.3")).getByRole("button", { name: "Remove" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove model" }));
    await settle();

    expect(deleteAccount).toHaveBeenCalledWith("h1", "a1");
    expect(listAccounts).toHaveBeenCalledTimes(2);
    expect(hubCards()).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Hugging Face · GLM-5.3 was removed.");
    expect(currentAddress()).toBe("/h/h1/models");
  });
});

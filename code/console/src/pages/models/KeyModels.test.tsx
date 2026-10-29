import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { keyModels } from "../../data/accountModels";
import { accountOf, callsTo as addCalls, labelled, press, renderAdd, secret, stubAccounts as stubAdd, typeInto } from "./addTesting";
import { claudeAccount, deferred, metaAccount, opened, renderEdit } from "./editTesting";

vi.mock("../../data/accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../data/accounts")>()),
  getAccount: vi.fn(),
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  setAccountKey: vi.fn(),
  testAccount: vi.fn(),
}));

const model = () => screen.getByLabelText(/^Model\*?$/);
const optionTexts = () => within(model()).getAllByRole("option").map((option) => option.textContent);
const asked = () => vi.mocked(keyModels);

beforeEach(() => {
  asked().mockReset();
  asked().mockRejectedValue(new Error("the provider was not reached"));
});

describe("the Model dropdown on an account whose key is saved", () => {
  it("is disabled and reads Loading models from the provider while the list is read", async () => {
    const pending = deferred<string[]>();
    asked().mockReturnValueOnce(pending.promise);
    renderEdit("a2", opened(claudeAccount, [metaAccount]));

    expect(await screen.findByText("Loading models from Claude…")).toBeInTheDocument();
    expect(model()).toBeDisabled();
    pending.resolve(["claude-sonnet-5-6"]);
    await waitFor(() => expect(model()).toBeEnabled());
  });

  it("asks for the account's list with the hub and the account", async () => {
    asked().mockResolvedValueOnce(["claude-sonnet-5-6"]);
    renderEdit("a2", opened(claudeAccount, [metaAccount]));

    await screen.findByText("From your key", { selector: "optgroup" }).catch(() => undefined);
    await waitFor(() => expect(asked()).toHaveBeenCalledWith("h1", "a2"));
  });

  it("shows the models of the key above the standard list under From your key, with Refresh models", async () => {
    asked().mockResolvedValueOnce(["claude-sonnet-5-6", "claude-sonnet-5-5"]);
    renderEdit("a2", opened(claudeAccount, [metaAccount]));

    await screen.findByText("Refresh models");
    expect(optionTexts()).toEqual([
      "Choose a model",
      "claude-sonnet-5-6",
      "Haiku 5.5 (claude-haiku-5-5)",
      "Sonnet 5.5 (claude-sonnet-5-5)",
      "Opus 5.5 (claude-opus-5-5)",
      "Fable 5.1 (claude-fable-5-1)",
      "Other model…",
    ]);
    expect(document.querySelector("optgroup")).toHaveAttribute("label", "From your key");
    expect(model()).toHaveValue("claude-sonnet-5-5");
  });

  it("reads the list again on Refresh models", async () => {
    asked().mockResolvedValueOnce(["claude-sonnet-5-6"]).mockResolvedValueOnce(["claude-sonnet-5-7"]);
    renderEdit("a2", opened(claudeAccount, [metaAccount]));

    await userEvent.click(await screen.findByText("Refresh models"));

    await waitFor(() => expect(optionTexts()).toContain("claude-sonnet-5-7"));
    expect(optionTexts()).not.toContain("claude-sonnet-5-6");
  });

  it("keeps the standard list with a note and Try again when the list cannot be read, and Try again reads it", async () => {
    asked().mockRejectedValueOnce(new Error("refused")).mockResolvedValueOnce(["claude-sonnet-5-6"]);
    renderEdit("a2", opened(claudeAccount, [metaAccount]));

    expect(await screen.findByText(/Could not read the list from Claude. Showing the standard list./)).toBeInTheDocument();
    expect(model()).toBeEnabled();
    expect(optionTexts()).toContain("Sonnet 5.5 (claude-sonnet-5-5)");
    expect(optionTexts()).toContain("Other model…");
    expect(document.querySelector("optgroup")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await screen.findByText("Refresh models");
    expect(optionTexts()).toContain("claude-sonnet-5-6");
  });

  it("is not asked for an account that has no key", async () => {
    renderEdit("a2", opened({ ...claudeAccount, keySet: false }, [metaAccount]));

    expect(await screen.findByText("Save the key to see every model it can use")).toBeInTheDocument();
    expect(asked()).not.toHaveBeenCalled();
  });
});

describe("Add a model: the list once the key is saved", () => {
  const addWithKey = async () => {
    const calls = stubAdd({ createAccount: accountOf({ modelName: "muse-spark-1.3" }) });
    renderAdd();
    await typeInto("Meta Model API key", secret);
    await press("Save");
    return calls;
  };

  it("asks for the new account's list after Save, then unlocks the Model dropdown with the key's models", async () => {
    asked().mockResolvedValueOnce(["muse-spark-1.4"]);
    const calls = await addWithKey();

    await screen.findByText("Refresh models");
    expect(asked()).toHaveBeenCalledWith("hub-a", "acc-1");
    expect(addCalls(calls, "setAccountKey")).toHaveLength(1);
    expect(model()).toBeEnabled();
    expect(optionTexts()).toContain("muse-spark-1.4");
    expect(screen.getByLabelText(labelled("Provider"))).toBeDisabled();
  });

  it("offers Save model for a model picked from the key's list, and saves it on the account", async () => {
    asked().mockResolvedValueOnce(["muse-spark-1.4"]);
    const calls = await addWithKey();
    await screen.findByText("Refresh models");
    expect(screen.queryByRole("button", { name: "Save model" })).not.toBeInTheDocument();

    await userEvent.selectOptions(model(), "muse-spark-1.4");
    vi.mocked((await import("../../data/accounts")).updateAccount).mockResolvedValue(accountOf({ modelName: "muse-spark-1.4" }));
    await press("Save model");

    const { updateAccount } = await import("../../data/accounts");
    await waitFor(() => expect(vi.mocked(updateAccount)).toHaveBeenCalledWith("hub-a", "acc-1", { modelName: "muse-spark-1.4" }));
    expect(addCalls(calls, "createAccount")).toHaveLength(1);
  });

  it("keeps the dropdown locked when no key was saved, with the hint", async () => {
    stubAdd();
    renderAdd();
    await press("Save");

    await screen.findByRole("button", { name: "Saved" });
    expect(model()).toBeDisabled();
    expect(asked()).not.toHaveBeenCalled();
  });
});

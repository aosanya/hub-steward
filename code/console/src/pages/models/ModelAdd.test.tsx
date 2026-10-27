import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { testAccount } from "../../data/accounts";
import { McpError } from "../../wakala/mcp";
import { accountOf, callsTo, choose, hub, labelled, outcomeOf, pageHolds, press, renderAdd, secret, stubAccounts, typeInto, type Replies, type TestOutcome } from "./addTesting";

vi.mock("../../data/accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../data/accounts")>()),
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  setAccountKey: vi.fn(),
  testAccount: vi.fn(),
}));

const fetching = vi.fn();

beforeEach(() => {
  fetching.mockReset();
  vi.stubGlobal("fetch", fetching);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const metaAdded = "Model added";
const claudeAdded = "Model added";
const keyField = "Meta Model API key";

const typeKey = (label: string = keyField, key = secret) => typeInto(label, key);

const saved = () => screen.findByRole("button", { name: "Saved" });

const addMeta = async (replies: Replies = {}) => {
  const calls = stubAccounts(replies);
  renderAdd();
  await press("Save");
  await saved();
  return calls;
};

const addMetaWithKey = async (replies: Replies = {}) => {
  const calls = stubAccounts(replies);
  renderAdd();
  await typeKey();
  await press("Save");
  await saved();
  return calls;
};

describe("Add a model: one Save button", () => {
  it("has a single Save, a Test connection and no Save model or Save key", () => {
    stubAccounts();
    renderAdd();

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Test connection" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save model" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save key" })).not.toBeInTheDocument();
  });

  it("is primary and on once a provider and model are chosen, with no key typed, and off while a model is not", async () => {
    stubAccounts();
    renderAdd();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeEnabled();
    expect(save).toHaveClass("primary");

    await userEvent.selectOptions(screen.getByLabelText(labelled("Model")), "");

    expect(save).toBeDisabled();
  });

  it("stays off for a typed key while no model is chosen", async () => {
    stubAccounts();
    renderAdd();
    await userEvent.selectOptions(screen.getByLabelText(labelled("Model")), "");

    await typeKey();

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

describe("Add a model: Save without a key", () => {
  it("lists the hub's accounts, then creates the Meta Model API account as an OpenAI-compatible one at Meta's address, chat on for the first, and sets no key", async () => {
    const calls = await addMeta();

    expect(calls.map((call) => call.fn)).toEqual(["listAccounts", "listAccounts", "createAccount"]);
    expect(calls[0].args).toEqual([hub.id]);
    expect(calls[2].args).toEqual([
      hub.id,
      {
        name: "Meta Model API · Muse Spark 1.3",
        provider: "openai_compatible",
        baseUrl: "https://api.meta.ai/v1",
        modelName: "muse-spark-1.3",
        chatEnabled: true,
      chatLabel: "",
      },
    ]);
  });

  it("creates Claude as the anthropic kind at Anthropic's own address, whatever the catalog's address says", async () => {
    const calls = stubAccounts();
    renderAdd();
    await choose("claude", "claude-sonnet-5-5");

    await press("Save");

    await saved();
    expect(callsTo(calls, "createAccount")[0].args[1]).toEqual({
      name: "Claude · Sonnet 5.5",
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      modelName: "claude-sonnet-5-5",
      chatEnabled: true,
      chatLabel: "",
    });
  });

  it("creates Hugging Face as an OpenAI-compatible account at the router's address", async () => {
    const calls = stubAccounts();
    renderAdd();
    await choose("huggingface", "zai-org/GLM-5.3:novita");

    await press("Save");

    await saved();
    expect(callsTo(calls, "createAccount")[0].args[1]).toEqual({
      name: "Hugging Face · GLM-5.3",
      provider: "openai_compatible",
      baseUrl: "https://router.huggingface.co/v1",
      modelName: "zai-org/GLM-5.3:novita",
      chatEnabled: true,
      chatLabel: "",
    });
  });

  it("sends the typed name trimmed and the typed address without its trailing slash for Other", async () => {
    const calls = stubAccounts();
    renderAdd();
    await choose("custom");
    await typeInto(labelled("Model name"), "  my-org/llama-4-open ");
    await typeInto(labelled("Base address"), " https://llm.example.org/v1/ ");

    await press("Save");

    await saved();
    expect(callsTo(calls, "createAccount")[0].args[1]).toEqual({
      name: "Other (OpenAI-compatible) · my-org/llama-4-open",
      provider: "openai_compatible",
      baseUrl: "https://llm.example.org/v1",
      modelName: "my-org/llama-4-open",
      chatEnabled: true,
      chatLabel: "",
    });
  });

  it("sends the base address as it was changed for Meta Model API", async () => {
    const calls = stubAccounts();
    renderAdd();
    await typeInto(labelled("Base address"), "https://eu.api.meta.ai/v1");

    await press("Save");

    await saved();
    expect(callsTo(calls, "createAccount")[0].args[1]).toMatchObject({ baseUrl: "https://eu.api.meta.ai/v1" });
  });

  it("sends the id typed under Other model for Meta Model API as the model name", async () => {
    const calls = stubAccounts();
    renderAdd();
    await userEvent.selectOptions(screen.getByLabelText(labelled("Model")), "other");
    await typeInto(labelled("Model name"), "muse-spark-1.4");

    await press("Save");

    await saved();
    expect(callsTo(calls, "createAccount")[0].args[1]).toMatchObject({
      name: "Meta Model API · muse-spark-1.4",
      modelName: "muse-spark-1.4",
      baseUrl: "https://api.meta.ai/v1",
    });
  });

  it("names the account apart from ones the hub already holds, and leaves the chat as it is", async () => {
    const calls = stubAccounts({
      listAccounts: [accountOf({ id: "a", name: "Claude · Sonnet 5.5", chatEnabled: true }), accountOf({ id: "b", name: "Claude · Sonnet 5.5 2" })],
    });
    renderAdd();
    await choose("claude", "claude-sonnet-5-5");

    await press("Save");

    await saved();
    expect(callsTo(calls, "createAccount")[0].args[1]).toMatchObject({ name: "Claude · Sonnet 5.5 3", chatEnabled: false });
  });

  it("turns chat on for the first account only", async () => {
    const calls = stubAccounts({ listAccounts: [accountOf({ name: "Hugging Face · GLM-5.3" })] });
    renderAdd();

    await press("Save");

    await saved();
    expect(callsTo(calls, "createAccount")[0].args[1]).toMatchObject({ name: "Meta Model API · Muse Spark 1.3", chatEnabled: false });
  });

  it("reads Saved and goes quiet once the account is created, with the choice locked", async () => {
    await addMeta();

    const done = screen.getByRole("button", { name: "Saved" });
    expect(done).toBeDisabled();
    expect(done).not.toHaveClass("primary");
    expect(screen.getByLabelText(labelled("Provider"))).toBeDisabled();
    expect(screen.getByLabelText(labelled("Model"))).toBeDisabled();
    expect(screen.getByLabelText(labelled("Base address"))).toBeDisabled();
  });

  it("does not create a second account", async () => {
    const calls = await addMeta();

    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
    expect(callsTo(calls, "createAccount")).toHaveLength(1);
  });

  it("shows the sentence the backend gave, without the tool's name, keeps the choice and sets no key when the account is refused", async () => {
    const calls = stubAccounts({ createAccount: new McpError("ai_create_account: base_url must not point at a private address") });
    renderAdd();
    await typeInto(labelled("Base address"), "https://10.0.0.8/v1");
    await typeKey();

    await press("Save");

    expect(await screen.findByText("base_url must not point at a private address")).toBeInTheDocument();
    expect(screen.queryByText(/ai_create_account/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByLabelText(labelled("Base address"))).toHaveValue("https://10.0.0.8/v1");
    expect(screen.getByLabelText(keyField)).toHaveValue(secret);
    expect(callsTo(calls, "setAccountKey")).toHaveLength(0);
    expect(document.querySelector(".notice")).toBeNull();
  });

  it("says the model could not be saved when the backend gave no sentence", async () => {
    stubAccounts({ createAccount: new Error("") });
    renderAdd();

    await press("Save");

    expect(await screen.findByText("The model could not be saved.")).toBeInTheDocument();
  });

  it("creates nothing when the hub's accounts cannot be read, and shows the sentence", async () => {
    const calls = stubAccounts({ listAccounts: new McpError("ai_list_accounts: the AI backend did not answer") });
    renderAdd();

    await press("Save");

    expect(await screen.findByText("the AI backend did not answer")).toBeInTheDocument();
    expect(callsTo(calls, "createAccount")).toHaveLength(0);
  });

  it("never reaches for the studio's routes", async () => {
    await addMetaWithKey();

    expect(fetching).not.toHaveBeenCalled();
  });
});

describe("Add a model: Save with a key", () => {
  it("creates the account and then sets the key in one press, in that order", async () => {
    const calls = await addMetaWithKey({ createAccount: accountOf({ id: "acc-77" }) });

    expect(calls.map((call) => call.fn)).toEqual(["listAccounts", "listAccounts", "createAccount", "setAccountKey"]);
    expect(callsTo(calls, "setAccountKey")[0].args).toEqual([hub.id, "acc-77", secret]);
  });

  it("empties the key field, reads Saved and locks the choice", async () => {
    await addMetaWithKey();

    expect(screen.getByLabelText(keyField)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
    expect(screen.getByLabelText(labelled("Provider"))).toBeDisabled();
  });

  it("keeps the key in no field, attribute or text of the page, nor the notice, after Save", async () => {
    stubAccounts();
    renderAdd();
    await typeKey();
    expect(pageHolds(secret)).toBe(true);

    await press("Save");
    await saved();

    expect(pageHolds(secret)).toBe(false);
  });

  it("keeps the key out of the page after Show key was pressed and Save finished", async () => {
    stubAccounts();
    renderAdd();
    await userEvent.click(screen.getByRole("button", { name: "Show key" }));
    await typeKey();
    expect(screen.getByLabelText(keyField)).toHaveAttribute("type", "text");

    await press("Save");
    await saved();

    expect(pageHolds(secret)).toBe(false);
  });

  it("hides the typed key as a password until Show key is pressed", async () => {
    stubAccounts();
    renderAdd();
    await typeKey();
    expect(screen.getByLabelText(keyField)).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Show key" }));
    expect(screen.getByLabelText(keyField)).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: "Hide key" }));
    expect(screen.getByLabelText(keyField)).toHaveAttribute("type", "password");
  });

  it("sends the key typed for the chosen provider", async () => {
    const calls = stubAccounts();
    renderAdd();
    await choose("claude", "claude-sonnet-5-5");
    await typeKey("Claude API key");

    await press("Save");

    await saved();
    expect(callsTo(calls, "setAccountKey")[0].args[2]).toBe(secret);
  });

  it("ignores a key of spaces: the account is created and no key is sent", async () => {
    const calls = stubAccounts();
    renderAdd();
    await userEvent.type(screen.getByLabelText(keyField), "   ");

    await press("Save");

    await saved();
    expect(callsTo(calls, "setAccountKey")).toHaveLength(0);
  });

  it("keeps the account, the notice and the key, and says so, when the key is refused, then retries with the same Save without a second account", async () => {
    const calls = stubAccounts({ setAccountKey: [new McpError("ai_set_account_key: the key was refused by the provider")] });
    renderAdd();
    await typeKey();

    await press("Save");

    expect(await screen.findByText("the key was refused by the provider")).toBeInTheDocument();
    expect(screen.getByText(metaAdded)).toBeInTheDocument();
    expect(screen.getByLabelText(keyField)).toHaveValue(secret);
    expect(screen.getByLabelText(labelled("Provider"))).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back to Models" })).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "Save" });
    expect(retry).toBeEnabled();
    expect(retry).toHaveClass("primary");

    await press("Save");

    await saved();
    expect(screen.queryByText("the key was refused by the provider")).not.toBeInTheDocument();
    expect(screen.getByLabelText(keyField)).toHaveValue("");
    expect(callsTo(calls, "createAccount")).toHaveLength(1);
    expect(callsTo(calls, "setAccountKey")).toHaveLength(2);
  });

  it("retries the key against the account it created, not a new one", async () => {
    const calls = stubAccounts({ createAccount: accountOf({ id: "acc-5" }), setAccountKey: [new Error("")] });
    renderAdd();
    await typeKey();
    await press("Save");
    await screen.findByText("The key could not be saved.");

    await press("Save");
    await saved();

    expect(callsTo(calls, "createAccount")).toHaveLength(1);
    expect(callsTo(calls, "setAccountKey").map((call) => call.args)).toEqual([
      [hub.id, "acc-5", secret],
      [hub.id, "acc-5", secret],
    ]);
  });

  it("says the key could not be saved when the backend gave no sentence", async () => {
    stubAccounts({ setAccountKey: new Error("") });
    renderAdd();
    await typeKey();

    await press("Save");

    expect(await screen.findByText("The key could not be saved.")).toBeInTheDocument();
  });

  it("leaves the key out of the line even when the backend echoes it", async () => {
    stubAccounts({ setAccountKey: new McpError(`ai_set_account_key: the key ${secret} was refused by the provider`) });
    renderAdd();
    await typeKey();

    await press("Save");

    const line = await screen.findByText(/was refused by the provider/);
    expect(line.textContent).not.toContain(secret);
    expect(line.textContent).not.toContain("ai_set_account_key");
  });

  it("scrubs a key the backend echoes in a plain error, in the page's own line as well as the data layer's", async () => {
    stubAccounts({ setAccountKey: new Error(`rejected: ${secret}`) });
    renderAdd();
    await typeKey();

    await press("Save");

    const line = await screen.findByText(/rejected:/);
    expect(line.textContent).not.toContain(secret);
  });

  it("turns Save on again for a replacement key typed after Save, and sets it on the same account", async () => {
    const calls = await addMetaWithKey();
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();

    await typeKey(keyField, "a-second-key");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await press("Save");

    await saved();
    expect(callsTo(calls, "createAccount")).toHaveLength(1);
    expect(callsTo(calls, "setAccountKey").map((call) => call.args[2])).toEqual([secret, "a-second-key"]);
  });
});

describe("Add a model: the notification and Back to Models", () => {
  it("says which model was added in a green bar right under the title", async () => {
    await addMeta();

    const bar = (await screen.findByText(metaAdded)).closest(".notice");
    expect(bar).toHaveAttribute("role", "status");
    expect(bar).toHaveClass("notice", "ok");
    expect(screen.getByRole("heading", { level: 1, name: "Add a model" }).closest(".top")?.nextElementSibling).toBe(bar);
  });

  it("names a Claude model the same way", async () => {
    stubAccounts();
    renderAdd();
    await choose("claude", "claude-sonnet-5-5");

    await press("Save");

    expect(await screen.findByText(claudeAdded)).toBeInTheDocument();
  });

  it("names a model the catalog does not know by what was typed", async () => {
    stubAccounts();
    renderAdd();
    await choose("claude", "other");
    await typeInto(labelled("Model name"), "claude-sonnet-5-6");

    await press("Save");

    expect(await screen.findByText("Model added")).toBeInTheDocument();
  });

  it("shows no bar before Save, and none when it is refused", async () => {
    stubAccounts({ createAccount: new McpError("ai_create_account: the name is taken") });
    renderAdd();
    expect(document.querySelector(".notice")).toBeNull();

    await press("Save");

    await screen.findByText("the name is taken");
    expect(document.querySelector(".notice")).toBeNull();
  });

  it("offers Back to Models only once the account is created, and it leaves the page", async () => {
    const onBack = vi.fn();
    stubAccounts();
    renderAdd({ onBack });
    expect(screen.queryByRole("button", { name: "Back to Models" })).not.toBeInTheDocument();

    await press("Save");
    await userEvent.click(await screen.findByRole("button", { name: "Back to Models" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("goes when it is dismissed, and leaves the form as it was", async () => {
    await addMeta();
    await screen.findByText(metaAdded);

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText(metaAdded)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
  });

  it("is spoken in the chosen language", async () => {
    localStorage.setItem("lang", "de");
    stubAccounts();
    renderAdd();

    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByText("Modell hinzugefügt")).toBeInTheDocument();
  });
});

describe("Add a model: Test connection", () => {
  const prompt = "Reply with the single word OK";

  const testIt = () => userEvent.click(screen.getByRole("button", { name: "Test connection" }));

  it("is off before the model is saved and while the account holds no key", async () => {
    stubAccounts();
    renderAdd();
    expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled();

    await press("Save");
    await saved();

    expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled();
  });

  it("turns on once the account holds a key, and stays on while another key is typed", async () => {
    await addMetaWithKey();
    expect(screen.getByRole("button", { name: "Test connection" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Test connection" })).not.toHaveClass("primary");

    await typeKey(keyField, "a-second-key");

    expect(screen.getByRole("button", { name: "Test connection" })).toBeEnabled();
  });

  it("shows nothing about a test before one is run", async () => {
    await addMetaWithKey();

    expect(screen.queryByText(/Sending a short message/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sent:/)).not.toBeInTheDocument();
  });

  it("shows the message going out, then what was sent and what answered, with the time", async () => {
    let finish: (outcome: TestOutcome) => void = () => {};
    await addMetaWithKey({ createAccount: accountOf({ id: "acc-9" }) });
    vi.mocked(testAccount).mockImplementationOnce(() => new Promise<TestOutcome>((resolve) => (finish = resolve)));

    await testIt();

    expect(await screen.findByText("Sending a short message to Meta Model API…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled();
    finish(outcomeOf({ prompt, reply: "OK", tookMs: 320 }));
    expect(await screen.findByText(`Sent: “${prompt}”`)).toBeInTheDocument();
    expect(screen.getByText("Answered: “OK” · 320 ms")).toBeInTheDocument();
    expect(screen.queryByText(/Sending a short message/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Test connection" })).toBeEnabled());
    expect(vi.mocked(testAccount)).toHaveBeenCalledWith(hub.id, "acc-9", "");
  });

  it("tests the key typed after the model was saved, not the saved one, and does not save it", async () => {
    const calls = await addMetaWithKey({ createAccount: accountOf({ id: "acc-9" }) });

    await typeKey(keyField, "a-second-key");
    await testIt();

    await screen.findByText("Answered: “OK” · 320 ms");
    expect(vi.mocked(testAccount)).toHaveBeenCalledWith(hub.id, "acc-9", "a-second-key");
    expect(callsTo(calls, "setAccountKey")).toHaveLength(1);
    expect(screen.getByLabelText(keyField)).toHaveValue("a-second-key");
  });

  it("shows a working answer with a check, not in red", async () => {
    await addMetaWithKey();

    await testIt();

    const line = (await screen.findByText("Answered: “OK” · 320 ms")).closest(".mk-result");
    expect(line).not.toHaveClass("bad");
    expect(line?.closest("[role=status]")).not.toBeNull();
  });

  it("shows Answered alone when the model sent nothing back, and leaves the time out when it is not known", async () => {
    await addMetaWithKey({ testAccount: outcomeOf({ reply: "", tookMs: null }) });

    await testIt();

    expect(await screen.findByText("Answered")).toBeInTheDocument();
    expect(screen.getByText(`Sent: “${prompt}”`)).toBeInTheDocument();
  });

  it("shows Not working with the reason, in red, with the prompt and the time, when the key is refused", async () => {
    await addMetaWithKey({ testAccount: outcomeOf({ working: false, reason: "the model refused the key", reply: "", tookMs: 85 }) });

    await testIt();

    const line = await screen.findByText("Not working: the model refused the key · 85 ms");
    expect(line.closest(".mk-result")).toHaveClass("bad");
    expect(screen.getByText(`Sent: “${prompt}”`)).toBeInTheDocument();
    expect(screen.queryByText(/Answered/)).not.toBeInTheDocument();
  });

  it("shows Not working with the backend's sentence, and no prompt, when the test itself is refused", async () => {
    await addMetaWithKey({ testAccount: new McpError("ai_test_account: the AI backend did not answer") });

    await testIt();

    expect(await screen.findByText("Not working: the AI backend did not answer")).toBeInTheDocument();
    expect(screen.queryByText(/Sent:/)).not.toBeInTheDocument();
  });

  it("clears an earlier outcome when the next Save starts", async () => {
    await addMetaWithKey();
    await testIt();
    await screen.findByText("Answered: “OK” · 320 ms");

    await typeKey(keyField, "a-second-key");
    await press("Save");

    await saved();
    expect(screen.queryByText(/Answered/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sent:/)).not.toBeInTheDocument();
  });

  it("keeps the key out of the page and the log through a whole add, save and test, even a refused one", async () => {
    await addMetaWithKey({ testAccount: outcomeOf({ working: false, reason: "the model refused the key", reply: "", tookMs: 85 }) });
    await testIt();
    await screen.findByText(/Not working/);

    expect(pageHolds(secret)).toBe(false);
  });

  it("speaks the chosen language in the log", async () => {
    localStorage.setItem("lang", "de");
    stubAccounts();
    renderAdd();
    await typeInto("Meta-Model-API-Schlüssel", secret);
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await screen.findByRole("button", { name: "Gespeichert" });

    await userEvent.click(screen.getByRole("button", { name: "Verbindung testen" }));

    expect(await screen.findByText(`Gesendet: „${prompt}“`)).toBeInTheDocument();
    expect(screen.getByText("Geantwortet: „OK“ · 320 ms")).toBeInTheDocument();
  });
});

import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { listAccounts } from "../../data/accounts";
import { McpError } from "../../wakala/mcp";
import { accountOf, callsTo, choose, labelled, pageHolds, press, renderAdd, secret, settled, stubAccounts, typeInto } from "./addTesting";

vi.mock("../../data/accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../data/accounts")>()),
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  setAccountKey: vi.fn(),
  testAccount: vi.fn(),
}));

afterEach(() => {
  localStorage.clear();
});

const chatBox = () => screen.getByRole("checkbox", { name: "Can be used in the chat" });
const chatName = () => screen.getByLabelText(labelled("Name in the chat"));
const created = (calls: ReturnType<typeof stubAccounts>) => callsTo(calls, "createAccount")[0].args[1];

const open = async (replies: Parameters<typeof stubAccounts>[0] = {}) => {
  const calls = stubAccounts(replies);
  renderAdd();
  await settled();
  return calls;
};

const chatModel = accountOf({ id: "chat-1", name: "Claude · Sonnet 5.5", chatEnabled: true });

describe("Add a model: the chat fields", () => {
  it("shows the Chat field with its checkbox and the Name in the chat field, ticked and prefilled with the model's name for the hub's first model", async () => {
    await open();

    expect(screen.getByRole("group", { name: "Chat" })).toBeInTheDocument();
    expect(chatBox()).toBeChecked();
    expect(chatName()).toBeEnabled();
    expect(chatName()).toHaveValue("Muse Spark 1.3");
  });

  it("sits in the form card under Base address and before the Connect a model card", async () => {
    await open();

    const base = screen.getByLabelText(labelled("Base address"));
    const chat = screen.getByRole("group", { name: "Chat" });
    const connect = screen.getByRole("heading", { name: "Connect a model" });
    const card = base.closest(".card");
    expect(card).not.toBeNull();
    expect(card).toContainElement(chat);
    expect(card).not.toContainElement(connect);
    expect(base.compareDocumentPosition(chat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(chat.compareDocumentPosition(connect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the name field to 60 characters", async () => {
    await open();

    await userEvent.clear(chatName());
    await userEvent.type(chatName(), "x".repeat(70));

    expect(chatName()).toHaveValue("x".repeat(60));
    expect(chatName()).toHaveAttribute("maxlength", "60");
  });

  it("is ticked for a hub whose accounts are not in the chat, and for one whose chat model is switched off", async () => {
    await open({ listAccounts: [accountOf({ chatEnabled: false }), accountOf({ id: "b", chatEnabled: true, status: "disabled" })] });

    expect(chatBox()).toBeChecked();
  });

  it("is ticked while the hub's accounts cannot be read", async () => {
    await open({ listAccounts: new McpError("ai_list_accounts: the AI backend did not answer") });

    expect(chatBox()).toBeChecked();
  });

  it("is unticked for a further model when the hub already has a chat model, with the name field off", async () => {
    await open({ listAccounts: [chatModel] });

    await waitFor(() => expect(chatBox()).not.toBeChecked());
    expect(chatName()).toBeDisabled();
    expect(chatName()).toHaveValue("Muse Spark 1.3");
  });

  it("leaves the hub's chat as it was when a further model is saved untouched", async () => {
    const calls = await open({ listAccounts: [chatModel] });
    await waitFor(() => expect(chatBox()).not.toBeChecked());

    await press("Save");

    await screen.findByRole("button", { name: "Saved" });
    expect(created(calls)).toMatchObject({ chatEnabled: false });
  });

  it("sends chat on for a further model once the admin ticks it", async () => {
    const calls = await open({ listAccounts: [chatModel] });
    await waitFor(() => expect(chatBox()).not.toBeChecked());

    await userEvent.click(chatBox());
    expect(chatBox()).toBeChecked();
    expect(chatName()).toBeEnabled();
    await press("Save");

    await screen.findByRole("button", { name: "Saved" });
    expect(created(calls)).toMatchObject({ chatEnabled: true });
  });

  it("sends chat off for the first model once the admin unticks it", async () => {
    const calls = await open();

    await userEvent.click(chatBox());
    await press("Save");

    await screen.findByRole("button", { name: "Saved" });
    expect(created(calls)).toMatchObject({ chatEnabled: false });
  });

  it("asks the backend again at Save, and follows it, when the admin has not touched the box and the hub's chat changed meanwhile", async () => {
    const calls = stubAccounts();
    vi.mocked(listAccounts).mockResolvedValueOnce([]).mockResolvedValueOnce([chatModel]);
    renderAdd();
    await settled();
    expect(chatBox()).toBeChecked();

    await press("Save");

    await screen.findByRole("button", { name: "Saved" });
    expect(created(calls)).toMatchObject({ chatEnabled: false });
    expect(chatBox()).not.toBeChecked();
  });

  it("keeps the name field off while the box is unticked, with what it held, and on again when it is ticked", async () => {
    await open();
    await userEvent.clear(chatName());
    await userEvent.type(chatName(), "Support bot");

    await userEvent.click(chatBox());
    expect(chatName()).toBeDisabled();
    expect(chatName()).toHaveValue("Support bot");

    await userEvent.click(chatBox());
    expect(chatName()).toBeEnabled();
  });
});

describe("Add a model: the name in the chat follows the model", () => {
  it("follows the model dropdown until it is edited", async () => {
    await open();

    await choose("claude", "claude-sonnet-5-5");
    expect(chatName()).toHaveValue("Sonnet 5.5");
    await userEvent.selectOptions(screen.getByLabelText(labelled("Model")), "claude-opus-5-5");
    expect(chatName()).toHaveValue("Opus 5.5");
    await choose("huggingface", "zai-org/GLM-5.3:novita");
    expect(chatName()).toHaveValue("GLM-5.3");
  });

  it("stops following once the person edits it", async () => {
    await open();
    await typeInto(labelled("Name in the chat"), "Support bot");

    await choose("claude", "claude-sonnet-5-5");

    expect(chatName()).toHaveValue("Support bot");
  });

  it("follows the name typed under Other model", async () => {
    await open();
    await choose("custom");

    await typeInto(labelled("Model name"), "my-org/llama-4-open");

    expect(chatName()).toHaveValue("my-org/llama-4-open");
  });

  it("is empty with the model's name as its hint while no model is chosen", async () => {
    await open();

    await userEvent.selectOptions(screen.getByLabelText(labelled("Model")), "");

    expect(chatName()).toHaveValue("");
    expect(chatName()).toHaveAttribute("placeholder", "");
  });

  it("shows the model's name as the hint when the name is emptied", async () => {
    await open();

    await userEvent.clear(chatName());

    expect(chatName()).toHaveValue("");
    expect(chatName()).toHaveAttribute("placeholder", "Muse Spark 1.3");
  });
});

describe("Add a model: what Save sends for the chat", () => {
  it("sends no label while the name is the model's own", async () => {
    const calls = await open();

    await press("Save");

    await screen.findByRole("button", { name: "Saved" });
    expect(created(calls)).toMatchObject({ chatEnabled: true, chatLabel: "" });
  });

  it("sends the edited name trimmed", async () => {
    const calls = await open();
    await typeInto(labelled("Name in the chat"), "  Support bot ");

    await press("Save");

    await screen.findByRole("button", { name: "Saved" });
    expect(created(calls)).toMatchObject({ chatEnabled: true, chatLabel: "Support bot" });
  });

  it("sends no label for an emptied name, which means the model's own", async () => {
    const calls = await open();
    await userEvent.clear(chatName());

    await press("Save");

    await screen.findByRole("button", { name: "Saved" });
    expect(created(calls)).toMatchObject({ chatLabel: "" });
  });

  it("sends no label for a name edited back to the model's own", async () => {
    const calls = await open();
    await typeInto(labelled("Name in the chat"), "Other");
    await typeInto(labelled("Name in the chat"), "Muse Spark 1.3");

    await press("Save");

    await screen.findByRole("button", { name: "Saved" });
    expect(created(calls)).toMatchObject({ chatLabel: "" });
  });

  it("sends the name that followed another model's", async () => {
    const calls = await open();
    await choose("claude", "claude-opus-5-5");

    await press("Save");

    await screen.findByRole("button", { name: "Saved" });
    expect(created(calls)).toMatchObject({ modelName: "claude-opus-5-5", chatLabel: "" });
  });

  it("accepts a name of exactly 60 characters", async () => {
    const calls = await open();
    await typeInto(labelled("Name in the chat"), "y".repeat(60));

    await press("Save");

    await screen.findByRole("button", { name: "Saved" });
    expect(created(calls)).toMatchObject({ chatLabel: "y".repeat(60) });
  });

  it("refuses a name over 60 characters with a sentence, creates nothing and keeps the form open", async () => {
    const calls = await open();
    fireEvent.change(chatName(), { target: { value: "z".repeat(61) } });

    await press("Save");

    expect(await screen.findByText("The name in the chat can be at most 60 characters.")).toBeInTheDocument();
    expect(callsTo(calls, "createAccount")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByLabelText(labelled("Provider"))).toBeEnabled();
    expect(document.querySelector(".notice")).toBeNull();
  });

  it("creates the account once the over-long name is cut to 60 characters", async () => {
    const calls = await open();
    fireEvent.change(chatName(), { target: { value: "z".repeat(61) } });
    await press("Save");
    await screen.findByText("The name in the chat can be at most 60 characters.");

    fireEvent.change(chatName(), { target: { value: "z".repeat(60) } });
    await press("Save");

    await screen.findByRole("button", { name: "Saved" });
    expect(callsTo(calls, "createAccount")).toHaveLength(1);
    expect(screen.queryByText("The name in the chat can be at most 60 characters.")).not.toBeInTheDocument();
  });

  it("locks both chat fields with the rest of the form after Save, showing what was sent", async () => {
    await open();
    await typeInto(labelled("Name in the chat"), "Support bot");

    await press("Save");

    await screen.findByRole("button", { name: "Saved" });
    expect(chatBox()).toBeDisabled();
    expect(chatBox()).toBeChecked();
    expect(chatName()).toBeDisabled();
    expect(chatName()).toHaveValue("Support bot");
  });

  it("keeps the chat fields as they were when the account is refused", async () => {
    stubAccounts({ createAccount: new McpError("ai_create_account: the name is taken") });
    renderAdd();
    await settled();
    await typeInto(labelled("Name in the chat"), "Support bot");

    await press("Save");

    await screen.findByText("the name is taken");
    expect(chatBox()).toBeEnabled();
    expect(chatName()).toHaveValue("Support bot");
  });

  it("keeps the key out of the page, the chat fields and the notice through a save with a chat name", async () => {
    stubAccounts();
    renderAdd();
    await settled();
    await typeInto(labelled("Name in the chat"), "Support bot");
    await typeInto("Meta Model API key", secret);

    await press("Save");
    await screen.findByRole("button", { name: "Saved" });

    expect(pageHolds(secret)).toBe(false);
  });

  it("speaks the chosen language in the fields and the refusal", async () => {
    localStorage.setItem("lang", "de");
    stubAccounts();
    renderAdd();
    await settled();
    expect(screen.getByRole("group", { name: "Chat" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Kann im Chat verwendet werden" })).toBeChecked();

    fireEvent.change(screen.getByLabelText("Name im Chat"), { target: { value: "z".repeat(61) } });
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByText("Der Name im Chat darf höchstens 60 Zeichen lang sein.")).toBeInTheDocument();
  });
});

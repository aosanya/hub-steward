import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  callsTo,
  claudeAccount,
  customAccount,
  glmAccount,
  metaAccount,
  noticeShowing,
  openWeightsAccount,
  opened,
  pageReady,
  renderEdit,
} from "./editTesting";

const modelLabel = /^Model\*?$/;
const modelNameLabel = /^Model name\*?$/;

vi.mock("../../data/accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../data/accounts")>()),
  getAccount: vi.fn(),
  listAccounts: vi.fn(),
  updateAccount: vi.fn(),
  setAccountKey: vi.fn(),
  testAccount: vi.fn(),
}));

const model = () => screen.getByLabelText(modelLabel);
const chatBox = () => screen.getByRole("checkbox", { name: "Can be used in the chat" });
const chatName = () => screen.getByLabelText("Name in the chat");
const saved = () => screen.queryByRole("button", { name: "Save" });
const cancel = () => screen.queryByRole("button", { name: "Cancel" });
const chooseModel = (value: string) => userEvent.selectOptions(model(), value);

const claudePage = () => renderEdit("a2", { ...opened(claudeAccount, [metaAccount]), updateAccount: claudeAccount });

describe("the Model dropdown", () => {
  it("lists the standard models of the provider with the saved one chosen and Other model… last", async () => {
    renderEdit("a2", opened(claudeAccount, [metaAccount]));
    await pageReady();

    const options = within(model()).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Choose a model",
      "Haiku 5.5 (claude-haiku-5-5)",
      "Sonnet 5.5 (claude-sonnet-5-5)",
      "Opus 5.5 (claude-opus-5-5)",
      "Fable 5.1 (claude-fable-5-1)",
      "Other model…",
    ]);
    expect(model()).toHaveValue("claude-sonnet-5-5");
  });

  it("shows a saved model the standard list does not know, chosen, above the standard ones", async () => {
    renderEdit("a5", opened(customAccount, [metaAccount]));
    await pageReady();

    expect(model()).toHaveDisplayValue("my-org/llama-4-open");
    expect(within(model()).getAllByRole("option").map((option) => option.textContent)).toEqual(["my-org/llama-4-open", "Other model…"]);
  });

  it("asks for a model name when Other model… is chosen, and not before", async () => {
    claudePage();
    await pageReady();
    expect(screen.queryByLabelText(modelNameLabel)).not.toBeInTheDocument();

    await chooseModel("other");

    expect(screen.getByLabelText(modelNameLabel)).toHaveValue("");
  });

  it("keeps Save off until the typed model name is not empty", async () => {
    claudePage();
    await pageReady();
    await chooseModel("other");

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(modelNameLabel), "claude-sonnet-6");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("saves a typed model name, trimmed", async () => {
    const calls = claudePage();
    await pageReady();
    await chooseModel("other");
    await userEvent.type(screen.getByLabelText(modelNameLabel), "  claude-sonnet-6 ");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByRole("heading", { name: "Connect a model" });
    expect(callsTo(calls, "updateAccount")[0].args).toEqual(["h1", "a2", { modelName: "claude-sonnet-6", chatEnabled: false, chatLabel: "" }]);
  });

  it("for open weights shows the model id the host gives, filled from the model chosen", async () => {
    renderEdit("a4", opened(openWeightsAccount, [metaAccount]));
    await pageReady();

    expect(model()).toHaveDisplayValue("Muse Spark Open");
    expect(screen.getByLabelText(modelNameLabel)).toHaveValue("muse-spark-open");
    expect(screen.getByText("Use the model id your host gives")).toBeInTheDocument();
    expect(screen.getByLabelText("Base address")).toHaveValue("https://muse.example.com/v1");

    await chooseModel("muse-glimmer");

    expect(screen.getByLabelText(modelNameLabel)).toHaveValue("muse-glimmer");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });
});

describe("Save and Cancel", () => {
  it("are not on the page while nothing has changed", async () => {
    claudePage();
    await pageReady();

    expect(saved()).not.toBeInTheDocument();
    expect(cancel()).not.toBeInTheDocument();
  });

  it("appear under the form when the model is changed", async () => {
    claudePage();
    await pageReady();
    await chooseModel("claude-opus-5-5");

    expect(saved()).toBeEnabled();
    expect(cancel()).toBeEnabled();
  });

  it("appear when the checkbox is ticked", async () => {
    claudePage();
    await pageReady();
    await userEvent.click(chatBox());

    expect(saved()).toBeInTheDocument();
    expect(cancel()).toBeInTheDocument();
  });

  it("appear when the name in the chat is typed", async () => {
    renderEdit("a1", opened(metaAccount, [glmAccount]));
    await pageReady();
    await userEvent.type(chatName(), "Fast");

    expect(saved()).toBeInTheDocument();
  });

  it("go away when the change is undone by hand", async () => {
    claudePage();
    await pageReady();
    await chooseModel("claude-opus-5-5");
    await chooseModel("claude-sonnet-5-5");

    expect(saved()).not.toBeInTheDocument();
  });

  it("restore the saved model, checkbox and name on Cancel", async () => {
    renderEdit("a2", opened(claudeAccount, [metaAccount]));
    await pageReady();
    await chooseModel("claude-opus-5-5");
    await userEvent.click(chatBox());
    await userEvent.type(chatName(), "Careful");
    await userEvent.click(cancel()!);

    expect(model()).toHaveValue("claude-sonnet-5-5");
    expect(chatBox()).not.toBeChecked();
    expect(chatName()).toHaveValue("");
    expect(saved()).not.toBeInTheDocument();
  });

  it("save the chosen model, then read the account again and settle on it", async () => {
    let held = claudeAccount;
    const calls = renderEdit("a2", {
      getAccount: () => held,
      listAccounts: () => [held, metaAccount],
      updateAccount: () => {
        held = { ...claudeAccount, modelName: "claude-opus-5-5" };
        return held;
      },
    });
    await pageReady();
    await chooseModel("claude-opus-5-5");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Claude · Opus 5.5" })).toBeInTheDocument();
    expect(callsTo(calls, "updateAccount")[0].args).toEqual(["h1", "a2", { modelName: "claude-opus-5-5", chatEnabled: false, chatLabel: "" }]);
    expect(callsTo(calls, "getAccount")).toHaveLength(2);
    expect(model()).toHaveValue("claude-opus-5-5");
    expect(saved()).not.toBeInTheDocument();
  });

  it("say the changes were saved in the green bar under the title, naming the model saved, and draw no inline Saved line", async () => {
    claudePage();
    await pageReady();
    await chooseModel("claude-opus-5-5");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const bar = await noticeShowing("The changes to Claude Opus 5.5 were saved.");
    expect(bar).toHaveClass("ok");
    expect(bar.previousElementSibling).toHaveClass("top");
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("are one Save button and no Save changes or Save key", async () => {
    claudePage();
    await pageReady();
    await chooseModel("claude-opus-5-5");

    expect(screen.getAllByRole("button", { name: /^Save/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save key" })).not.toBeInTheDocument();
  });

  it("keep the change and show the backend's sentence in a red bar when the save fails", async () => {
    renderEdit("a2", { ...opened(claudeAccount, [metaAccount]), updateAccount: new Error("the hub has no other model for the chat") });
    await pageReady();
    await chooseModel("claude-opus-5-5");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const bar = await screen.findByRole("alert");
    expect(bar).toHaveClass("bad");
    expect(bar).toHaveTextContent("the hub has no other model for the chat");
    expect(model()).toHaveValue("claude-opus-5-5");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("say the model could not be saved when the failure carries no sentence", async () => {
    renderEdit("a2", { ...opened(claudeAccount, [metaAccount]), updateAccount: new Error("") });
    await pageReady();
    await chooseModel("claude-opus-5-5");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The model could not be saved.");
  });

  it("leave a typed key out of the failure's sentence", async () => {
    const secret = "sk-ant-typed-and-not-yet-saved";
    renderEdit("a2", { ...opened(claudeAccount, [metaAccount]), updateAccount: new Error(`the request carried ${secret}`) });
    await pageReady();
    await userEvent.type(screen.getByLabelText("Replace the key"), secret);
    await chooseModel("claude-opus-5-5");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const bar = await screen.findByRole("alert");
    expect(bar.textContent).not.toContain(secret);
  });
});

describe("the checkbox Can be used in the chat", () => {
  it("is under the label Chat, unticked for a model the chat cannot use, with its name field off", async () => {
    renderEdit("a2", opened(claudeAccount, [metaAccount]));
    await pageReady();

    expect(screen.getByText("Chat", { selector: ".field-label" })).toBeInTheDocument();
    expect(chatBox()).not.toBeChecked();
    expect(chatBox()).toBeEnabled();
    expect(chatName()).toBeDisabled();
  });

  it("is ticked for a model the chat can use, with its name field on", async () => {
    renderEdit("a1", opened(metaAccount, [glmAccount]));
    await pageReady();

    expect(chatBox()).toBeChecked();
    expect(chatBox()).toBeEnabled();
    expect(chatName()).toBeEnabled();
  });

  it("turns the name field on when ticked and off when unticked", async () => {
    claudePage();
    await pageReady();
    await userEvent.click(chatBox());
    expect(chatName()).toBeEnabled();

    await userEvent.click(chatBox());
    expect(chatName()).toBeDisabled();
  });

  it("is ticked and cannot be unticked for the only model the chat can use", async () => {
    renderEdit("a1", opened(metaAccount, [claudeAccount]));
    await pageReady();

    expect(chatBox()).toBeChecked();
    expect(chatBox()).toBeDisabled();
    expect(chatName()).toBeEnabled();
  });

  it("is not held when another model can be used in the chat too", async () => {
    renderEdit("a1", opened(metaAccount, [glmAccount, claudeAccount]));
    await pageReady();

    expect(chatBox()).toBeEnabled();
  });

  it("does not count a model that is switched off as one the chat can use", async () => {
    renderEdit("a1", opened(metaAccount, [{ ...glmAccount, status: "disabled" }]));
    await pageReady();

    expect(chatBox()).toBeDisabled();
  });

  it("is not held for a model the chat cannot use, even when no model can be used in the chat", async () => {
    renderEdit("a2", opened(claudeAccount, [{ ...metaAccount, chatEnabled: false }]));
    await pageReady();

    expect(chatBox()).toBeEnabled();
    expect(chatBox()).not.toBeChecked();
  });

  it("saves ticked, with the name typed", async () => {
    const calls = claudePage();
    await pageReady();
    await userEvent.click(chatBox());
    await userEvent.type(chatName(), "Careful");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("heading", { name: "Connect a model" });

    expect(callsTo(calls, "updateAccount")[0].args).toEqual(["h1", "a2", { modelName: "claude-sonnet-5-5", chatEnabled: true, chatLabel: "Careful" }]);
  });

  it("saves unticked when another model can be used in the chat", async () => {
    const calls = renderEdit("a1", { ...opened(metaAccount, [glmAccount]), updateAccount: { ...metaAccount, chatEnabled: false } });
    await pageReady();
    await userEvent.click(chatBox());
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("heading", { name: "Connect a model" });

    expect(callsTo(calls, "updateAccount")[0].args).toEqual(["h1", "a1", { modelName: "muse-spark-1.3", chatEnabled: false, chatLabel: "" }]);
  });
});

describe("the name in the chat", () => {
  it("shows the saved name", async () => {
    renderEdit("a3", opened(glmAccount, [metaAccount]));
    await pageReady();

    expect(chatName()).toHaveValue("GLM-5.3 (Hugging Face)");
  });

  it("shows the model's own name as the placeholder while empty", async () => {
    renderEdit("a1", opened(metaAccount, [glmAccount]));
    await pageReady();

    expect(chatName()).toHaveValue("");
    expect(chatName()).toHaveAttribute("placeholder", "Muse Spark 1.3");
  });

  it("follows the model chosen in its placeholder", async () => {
    renderEdit("a2", opened(claudeAccount, [metaAccount]));
    await pageReady();
    await chooseModel("claude-opus-5-5");

    expect(chatName()).toHaveAttribute("placeholder", "Opus 5.5");
  });

  it("takes at most 60 characters", async () => {
    renderEdit("a1", opened(metaAccount, [glmAccount]));
    await pageReady();
    expect(chatName()).toHaveAttribute("maxLength", "60");

    await userEvent.type(chatName(), "x".repeat(75));

    expect(chatName()).toHaveValue("x".repeat(60));
  });

  it("saves a name of exactly 60 characters", async () => {
    const label = "n".repeat(60);
    const calls = renderEdit("a1", { ...opened(metaAccount, [glmAccount]), updateAccount: metaAccount });
    await pageReady();
    await userEvent.type(chatName(), label);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("heading", { name: "Connect a model" });

    expect(callsTo(calls, "updateAccount")[0].args[2]).toMatchObject({ chatLabel: label });
  });

  it("saves an emptied name as empty, so the chat shows the model's own name", async () => {
    const calls = renderEdit("a3", { ...opened(glmAccount, [metaAccount]), updateAccount: { ...glmAccount, chatLabel: "" } });
    await pageReady();
    await userEvent.clear(chatName());
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("heading", { name: "Connect a model" });

    expect(callsTo(calls, "updateAccount")[0].args[2]).toMatchObject({ chatEnabled: true, chatLabel: "" });
  });

  it("does not count blanks around the saved name as a change", async () => {
    renderEdit("a3", opened({ ...glmAccount, chatLabel: "  GLM  " }, [metaAccount]));
    await pageReady();

    expect(chatName()).toHaveValue("GLM");
    expect(saved()).not.toBeInTheDocument();
  });

  it("is not typed into while the checkbox is unticked", async () => {
    renderEdit("a2", opened(claudeAccount, [metaAccount]));
    await pageReady();
    await userEvent.type(chatName(), "Careful");

    expect(chatName()).toHaveValue("");
    expect(saved()).not.toBeInTheDocument();
  });
});

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { failedText, inlineStatusLines, noticeShowing, refused, renderAgentEdit, savedText, type Replies } from "./testing";

vi.mock("../../data/agent");

const options = [
  { id: "a1", label: "Hugging Face · GLM-5.3" },
  { id: "a2", label: "Claude · Sonnet 5.5" },
];

const open = (row: object, extra: Replies = {}) =>
  renderAgentEdit("/h/h1/agent-edit/Assets%20Keeper/model", { agentRows: { rows: [row] }, ...extra });

describe("the Model tab", () => {
  it("shows the chosen model selected and no warning when the agent has a model", async () => {
    open({ name: "Assets Keeper", account_id: "a2", options });
    const select = await screen.findByLabelText("Model");
    expect(select).toHaveValue("a2");
    expect(screen.queryByText("No model: this agent cannot speak.")).not.toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("names each model with its provider when the account says which provider it is", async () => {
    open({
      name: "Assets Keeper",
      account_id: "a2",
      options: [
        { id: "a1", label: "glm", provider: "openai_compatible", baseUrl: "https://router.huggingface.co/v1", modelName: "zai-org/GLM-5.3:novita" },
        { id: "a2", label: "claude-sonnet-5-5", provider: "anthropic", baseUrl: "https://api.anthropic.com", modelName: "claude-sonnet-5-5" },
      ],
    });
    await screen.findByLabelText("Model");
    expect(screen.getByRole("option", { name: "Claude · Sonnet 5.5" })).toHaveValue("a2");
    expect(screen.getByRole("option", { name: /^Hugging Face · / })).toHaveValue("a1");
  });

  it("puts the model choice in a settings row of its own, labelled Model", async () => {
    open({ name: "Assets Keeper", account_id: "a2", options });
    const select = await screen.findByLabelText("Model");
    const setting = select.closest(".setting") as HTMLElement;
    expect(within(setting).getByText("Model")).toHaveClass("setting-label");
    expect(select.closest(".setting-control")).not.toBeNull();
  });

  it("says the agent cannot speak in a warning tile and starts on Choose a model when it has no model", async () => {
    open({ name: "Assets Keeper", account_id: null, options });
    const select = await screen.findByLabelText("Model");
    expect(screen.getByText("No model: this agent cannot speak.").closest(".tile")).toHaveClass("warn");
    expect(select).toHaveValue("");
    expect(screen.getAllByRole("option")[0]).toHaveValue("");
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Choose a model");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("keeps Save changes in the title row, beside the agent's name", async () => {
    open({ name: "Assets Keeper", account_id: "a1", options });
    await screen.findByLabelText("Model");
    const title = screen.getByRole("heading", { level: 1, name: "Assets Keeper" }).parentElement as HTMLElement;
    expect(within(title).getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Save changes" })).toHaveLength(1);
  });

  it("saves the chosen model and says so in the green bar under the title", async () => {
    const calls = open(
      { name: "Assets Keeper", account_id: null, options },
      { saveAgentModel: {} },
    );
    await userEvent.selectOptions(await screen.findByLabelText("Model"), "a1");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const bar = await noticeShowing(savedText);
    expect(bar).toHaveClass("ok");
    expect(bar).toHaveAttribute("role", "status");
    expect(calls.find((c) => c.fn === "saveAgentModel")).toEqual({ fn: "saveAgentModel", args: ["h1", "Assets Keeper", "a1"] });
  });

  it("puts the green bar directly under the title row and keeps no status line of its own after a save", async () => {
    open({ name: "Assets Keeper", account_id: "a1", options }, { saveAgentModel: {} });
    await screen.findByLabelText("Model");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const bar = await noticeShowing(savedText);
    expect(bar.previousElementSibling).toHaveClass("top");
    expect(screen.getAllByText(savedText)).toHaveLength(1);
    expect(inlineStatusLines()).toHaveLength(0);
  });

  it("shows the red bar when the save is refused", async () => {
    open(
      { name: "Assets Keeper", account_id: "a1", options },
      { saveAgentModel: refused() },
    );
    await screen.findByLabelText("Model");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const bar = await noticeShowing(failedText);
    expect(bar).toHaveClass("bad");
    expect(bar).toHaveAttribute("role", "alert");
    expect(bar.previousElementSibling).toHaveClass("top");
    expect(screen.queryByText(savedText)).not.toBeInTheDocument();
    expect(inlineStatusLines()).toHaveLength(0);
  });
});

describe("the question why an agent stopped", () => {
  const ask = "Why did the Assets Keeper stop?";

  it("names the agent in the button and asks nothing until it is pressed", async () => {
    const calls = open({ name: "Assets Keeper", account_id: "a1", options });
    expect(await screen.findByRole("button", { name: ask })).toBeInTheDocument();
    expect(calls.some((c) => c.fn === "agentStopped")).toBe(false);
  });

  it("shows the answer as a warning sentence card with the limit, where it is set and when it was posted", async () => {
    open(
      { name: "Assets Keeper", account_id: "a1", options },
      {
        agentStopped: {
          stopped: "This AI role's weekly token limit is reached.",
          limit: "Tokens per week, 500,000 of 500,000",
          set_on: "The role",
          posted: "Once, at 09:12",
        },
      },
    );
    await userEvent.click(await screen.findByRole("button", { name: ask }));
    const sentence = await screen.findByText("This AI role's weekly token limit is reached.");
    expect(sentence.closest(".tile")).toHaveClass("warn");
    expect(within(sentence.closest(".tile") as HTMLElement).getByText("Stopped")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Why the Assets Keeper stopped" })).toBeInTheDocument();
    expect(screen.getByText("Limit")).toBeInTheDocument();
    expect(screen.getByText("Tokens per week, 500,000 of 500,000")).toBeInTheDocument();
    expect(screen.getByText("Set on")).toBeInTheDocument();
    expect(screen.getByText("The role")).toBeInTheDocument();
    expect(screen.getByText("Posted in the room")).toBeInTheDocument();
    expect(screen.getByText("Once, at 09:12")).toBeInTheDocument();
  });

  it("shows the answer under the question it answers, and Clear takes it away and brings the button back", async () => {
    open(
      { name: "Assets Keeper", account_id: "a1", options },
      { agentStopped: { stopped: "It has not stopped.", limit: "", set_on: "", posted: "" } },
    );
    await userEvent.click(await screen.findByRole("button", { name: ask }));
    const answer = await screen.findByRole("region", { name: "Answer from the chat" });
    expect(within(answer).getByText("Answer to:")).toBeInTheDocument();
    expect(within(answer).getByText(ask)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ask })).not.toBeInTheDocument();

    await userEvent.click(within(answer).getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("region", { name: "Answer from the chat" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: ask })).toBeInTheDocument();
  });

  it("leaves out the details that are empty, and shows a calm tile when the agent has not stopped", async () => {
    open(
      { name: "Assets Keeper", account_id: "a1", options },
      { agentStopped: { stopped: "It has not stopped.", limit: "", set_on: "", posted: "" } },
    );
    await userEvent.click(await screen.findByRole("button", { name: ask }));
    const sentence = await screen.findByText("It has not stopped.");
    expect(sentence.closest(".tile")).not.toHaveClass("warn");
    expect(screen.queryByText("Limit")).not.toBeInTheDocument();
    expect(screen.queryByText("Set on")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Why the Assets Keeper stopped" })).not.toBeInTheDocument();
  });

  it("says the page could not be loaded when the answer fails", async () => {
    open({ name: "Assets Keeper", account_id: "a1", options }, { agentStopped: refused() });
    await userEvent.click(await screen.findByRole("button", { name: ask }));
    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("empty", "error");
  });

  it("can be asked from the Limits tab too, where the limit that stopped it is set", async () => {
    renderAgentEdit("/h/h1/agent-edit/Assets%20Keeper/limits", {
      agentRows: { rows: [{ name: "Assets Keeper", account_id: "a1", options }] },
      agentLimits: { rows: [] },
      agentStopped: { stopped: "This AI role's weekly token limit is reached.", limit: "Tokens per week", set_on: "", posted: "" },
    });
    await userEvent.click(await screen.findByRole("button", { name: ask }));
    expect(await screen.findByText("This AI role's weekly token limit is reached.")).toBeInTheDocument();
  });
});

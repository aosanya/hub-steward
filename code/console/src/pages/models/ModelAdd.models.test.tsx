import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { choose, labelled, optionsOf, renderAdd, stubAccounts, typeInto } from "./addTesting";

vi.mock("../../data/accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../data/accounts")>()),
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  setAccountKey: vi.fn(),
  testAccount: vi.fn(),
}));

beforeEach(() => {
  stubAccounts();
});

afterEach(() => {
  localStorage.clear();
});

const saveButton = () => screen.getByRole("button", { name: "Save" });

describe("Add a model: the Provider dropdown", () => {
  it("lists Meta Model API first, then the catalog's other providers, and nothing else", () => {
    renderAdd();

    expect(optionsOf("Provider")).toEqual([
      "Choose a provider",
      "Meta Model API",
      "Meta open weights (Baseten, Modal or your own server)",
      "Hugging Face",
      "Claude",
      "Other (OpenAI-compatible)",
    ]);
  });

  it("opens on Meta Model API with Muse Spark 1.3 chosen and Meta's address filled in", () => {
    renderAdd();

    expect(screen.getByLabelText(labelled("Provider"))).toHaveValue("meta");
    expect(screen.getByLabelText(labelled("Model"))).toHaveValue("muse-spark-1.3");
    expect(screen.getByLabelText(labelled("Base address"))).toHaveValue("https://api.meta.ai/v1");
  });

  it("opens on the model it was started with", () => {
    renderAdd({ start: { provider: "claude", model: "claude-opus-5-5" } });

    expect(screen.getByLabelText(labelled("Provider"))).toHaveValue("claude");
    expect(screen.getByLabelText(labelled("Model"))).toHaveValue("claude-opus-5-5");
  });

  it("starts with nothing chosen, the model list and the key field off, and says to choose a provider first, once the provider is cleared", async () => {
    renderAdd();

    await userEvent.selectOptions(screen.getByLabelText(labelled("Provider")), "");

    expect(screen.getByLabelText(labelled("Model"))).toBeDisabled();
    expect(screen.getByLabelText("Key")).toBeDisabled();
    expect(screen.getByText("Choose a provider first.")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByLabelText(labelled("Base address"))).not.toBeInTheDocument();
  });

  it("empties the model when the provider changes and labels the key field for the new provider", async () => {
    renderAdd();

    await choose("claude");

    expect(screen.getByLabelText(labelled("Model"))).toHaveValue("");
    expect(screen.getByLabelText("Claude API key")).toBeEnabled();
    expect(saveButton()).toBeDisabled();
  });

  it("fills Meta's address again when Meta Model API is chosen again, and drops one typed for another provider", async () => {
    renderAdd();
    await typeInto(labelled("Base address"), "https://elsewhere.example.org/v1");

    await choose("claude");
    await choose("meta");

    expect(screen.getByLabelText(labelled("Base address"))).toHaveValue("https://api.meta.ai/v1");
  });

  it("points Where do I find this key to the chosen provider's key page, and to nothing for Other", async () => {
    renderAdd();

    expect(screen.getByRole("link", { name: "Where do I find this key?" })).toHaveAttribute("href", "https://dev.meta.ai");
    await choose("claude");
    expect(screen.getByRole("link", { name: "Where do I find this key?" })).toHaveAttribute("href", "https://console.anthropic.com/settings/keys");
    await choose("custom");
    expect(screen.queryByRole("link", { name: "Where do I find this key?" })).not.toBeInTheDocument();
  });
});

describe("Add a model: the Model dropdown follows the catalog", () => {
  it("offers the Muse Spark models and Other model for Meta Model API", () => {
    renderAdd();

    expect(optionsOf("Model")).toEqual([
      "Choose a model",
      "Muse Spark 1.3 (muse-spark-1.3)",
      "Muse Spark 1.2 (muse-spark-1.2)",
      "Muse Spark 1.1 (muse-spark-1.1)",
      "Muse Spark 1.3 (contributor mode) (muse-spark-1.3-contributor)",
      "Muse Spark 1.2 (contributor mode) (muse-spark-1.2-contributor)",
      "Other model…",
    ]);
  });

  it("offers GLM-5.3 for Hugging Face and the four models for Claude, each with its id", async () => {
    renderAdd();

    await choose("huggingface");
    expect(optionsOf("Model")).toEqual(["Choose a model", "GLM-5.3 (zai-org/GLM-5.3:novita)", "Other model…"]);
    await choose("claude");
    expect(optionsOf("Model")).toEqual([
      "Choose a model",
      "Haiku 5.5 (claude-haiku-5-5)",
      "Sonnet 5.5 (claude-sonnet-5-5)",
      "Opus 5.5 (claude-opus-5-5)",
      "Fable 5.1 (claude-fable-5-1)",
      "Other model…",
    ]);
  });

  it("offers the open weights models by name for Meta open weights", async () => {
    renderAdd();

    await choose("meta_open");

    expect(optionsOf("Model")).toEqual(["Choose a model", "Muse Spark Open", "Muse Glimmer", "Other model…"]);
  });

  it("offers only Other model, already chosen, for Other (OpenAI-compatible)", async () => {
    renderAdd();

    await choose("custom");

    expect(optionsOf("Model")).toEqual(["Other model…"]);
    expect(screen.getByLabelText(labelled("Model"))).toHaveValue("other");
  });

  it("shows the standard list and the hint to save the key before the key is saved", async () => {
    renderAdd();
    await choose("claude", "claude-sonnet-5-5");

    expect(screen.getByText("Save the key to see every model it can use")).toBeInTheDocument();
    expect(screen.queryByText("From your key")).not.toBeInTheDocument();
    expect(screen.queryByText("Refresh models")).not.toBeInTheDocument();
    expect(screen.queryByText(/Loading models from/)).not.toBeInTheDocument();
    expect(document.querySelector("optgroup")).toBeNull();
  });

  it("marks no model In use", () => {
    renderAdd();

    expect(screen.queryByText(/In use/)).not.toBeInTheDocument();
  });

  it("opens on GLM-5.3 with no base address when started on Hugging Face", () => {
    renderAdd({ start: { provider: "huggingface", model: "zai-org/GLM-5.3:novita" } });

    expect(screen.getByLabelText(labelled("Model"))).toHaveValue("zai-org/GLM-5.3:novita");
    expect(screen.queryByLabelText(labelled("Base address"))).not.toBeInTheDocument();
  });
});

describe("Add a model: Other model asks for a name", () => {
  it("shows the Model name field only once Other model is chosen", async () => {
    renderAdd();
    await choose("claude", "claude-sonnet-5-5");
    expect(screen.queryByLabelText(labelled("Model name"))).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(labelled("Model")), "other");

    expect(screen.getByLabelText(labelled("Model name"))).toHaveValue("");
  });

  it("keeps Save off until a name is typed, and trims what is typed", async () => {
    renderAdd();
    await choose("claude", "other");
    expect(saveButton()).toBeDisabled();

    await typeInto(labelled("Model name"), "   ");
    expect(saveButton()).toBeDisabled();

    await typeInto(labelled("Model name"), "claude-sonnet-5-6");
    expect(saveButton()).toBeEnabled();
  });

  it("asks for a name for Meta Model API under Other model, with the address still filled in", async () => {
    renderAdd();

    await userEvent.selectOptions(screen.getByLabelText(labelled("Model")), "other");

    expect(screen.getByLabelText(labelled("Model name"))).toHaveValue("");
    expect(screen.getByLabelText(labelled("Base address"))).toHaveValue("https://api.meta.ai/v1");
    expect(saveButton()).toBeDisabled();
  });

  it("suggests the id of a Meta open weights model in the name field, with the host hint", async () => {
    renderAdd();
    await choose("meta_open", "muse-spark-open");

    expect(screen.getByLabelText(labelled("Model name"))).toHaveValue("muse-spark-open");
    expect(screen.getByText("Use the model id your host gives")).toBeInTheDocument();
    expect(screen.getByText(/The OpenAI-compatible address your host gives/)).toBeInTheDocument();
  });

  it("hides the Model name field again when a listed model is chosen after Other model", async () => {
    renderAdd();
    await choose("claude", "other");

    await userEvent.selectOptions(screen.getByLabelText(labelled("Model")), "claude-opus-5-5");

    expect(screen.queryByLabelText(labelled("Model name"))).not.toBeInTheDocument();
  });
});

describe("Add a model: the base address", () => {
  it("is asked for Meta Model API, Meta open weights and Other, and not for Hugging Face or Claude", async () => {
    renderAdd();
    expect(screen.getByLabelText(labelled("Base address"))).toBeInTheDocument();

    await choose("huggingface");
    expect(screen.queryByLabelText(labelled("Base address"))).not.toBeInTheDocument();
    await choose("claude");
    expect(screen.queryByLabelText(labelled("Base address"))).not.toBeInTheDocument();
    await choose("meta_open");
    expect(screen.getByLabelText(labelled("Base address"))).toHaveValue("");
    await choose("custom");
    expect(screen.getByLabelText(labelled("Base address"))).toHaveValue("");
  });

  it("says under the field that the address must start with https:// and keeps Save off for an http address", async () => {
    renderAdd();

    await typeInto(labelled("Base address"), "http://api.meta.ai/v1");

    expect(screen.getByText("The address must start with https://")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("takes the sentence away and turns Save on once the address is an https address", async () => {
    renderAdd();
    await typeInto(labelled("Base address"), "http://api.meta.ai/v1");

    await typeInto(labelled("Base address"), "https://api.meta.ai/v1");

    expect(screen.queryByText("The address must start with https://")).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it("accepts https in capitals, and says nothing for an empty address though Save stays off", async () => {
    renderAdd();
    await typeInto(labelled("Base address"), "HTTPS://api.meta.ai/v1");
    expect(screen.queryByText("The address must start with https://")).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();

    await userEvent.clear(screen.getByLabelText(labelled("Base address")));

    expect(screen.queryByText("The address must start with https://")).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("needs both a name and an address for Other (OpenAI-compatible)", async () => {
    renderAdd();
    await choose("custom");
    expect(saveButton()).toBeDisabled();

    await typeInto(labelled("Model name"), "my-org/llama-4-open");
    expect(saveButton()).toBeDisabled();

    await typeInto(labelled("Base address"), "https://llm.example.org/v1");
    expect(saveButton()).toBeEnabled();
  });

  it("speaks the chosen language in the sentence under the field", async () => {
    localStorage.setItem("lang", "de");
    renderAdd();

    await typeInto(labelled("Basisadresse"), "http://api.meta.ai/v1");

    expect(screen.getByText("Die Adresse muss mit https:// beginnen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Speichern" })).toBeDisabled();
  });
});

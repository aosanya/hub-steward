import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { listAccounts } from "../../data/accounts";
import { modelAccounts, saveModelLimits, type HeldLimits, type ModelAccount } from "../../data/modelLimits";
import type { Hub } from "../../types";
import { glm, noLimits, openModel, owner, sonnet, staff } from "./harness";

vi.mock("../../data/accounts", async (original) => {
  const actual = await original<typeof import("../../data/accounts")>();
  return { ...actual, listAccounts: vi.fn() };
});

vi.mock("../../data/modelLimits", async (original) => {
  const actual = await original<typeof import("../../data/modelLimits")>();
  return { ...actual, modelAccounts: vi.fn(), saveModelLimits: vi.fn() };
});

const open = async (models: ModelAccount[] | Error, hub: Hub = owner, id: string = glm.id) => {
  vi.mocked(saveModelLimits).mockReset();
  vi.mocked(saveModelLimits).mockResolvedValue(undefined);
  await openModel(models, "limits", hub, id);
};

const rowOf = (label: string) => screen.getByText(label, { selector: ".setting-label" }).closest(".setting") as HTMLElement;
const fieldOf = (label: string) => within(rowOf(label)).getByRole("textbox");
const switchOf = (label: string) => within(rowOf(label)).getByRole("switch");
const savedWith = (changes: Partial<HeldLimits>): HeldLimits => ({ ...glm.limits, ...changes });
const savedText = "The limits were saved.";
const failedText = "The change could not be sent.";
const barWith = async (text: string) => (await screen.findByText(text)).closest(".notice") as HTMLElement;
const pressSave = () => userEvent.click(screen.getByRole("button", { name: "Save limits" }));
const retype = async (label: string, digits: string) => {
  await userEvent.clear(fieldOf(label));
  await userEvent.type(fieldOf(label), digits);
};

describe("the Limits tab of a model", () => {
  it("is titled with the provider and the model, with no button beside the title", async () => {
    await open([glm]);
    expect(screen.getByRole("heading", { level: 1, name: "Hugging Face · GLM-5.3" })).toBeInTheDocument();
    expect(document.querySelector(".top-end")).toBeEmptyDOMElement();
  });

  it("reads the models of the open hub", async () => {
    await open([glm]);
    expect(modelAccounts).toHaveBeenCalledWith("h1");
    expect(listAccounts).toHaveBeenCalledWith("h1");
  });

  it("offers Key and test and Usage as the pages beside it, and Limits as the page it is on", async () => {
    await open([glm]);
    expect(screen.getByText("Limits", { selector: ".tab" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Key and test" })).toHaveAttribute("href", "/h/h1/models/c1/key");
    expect(screen.getByRole("link", { name: "Usage" })).toHaveAttribute("href", "/h/h1/models/c1/usage");
  });

  it("draws one card that names the tool it saves through", async () => {
    await open([glm]);
    expect(document.querySelectorAll(".card")).toHaveLength(1);
    expect(screen.getByText("ai_set_limits")).toHaveClass("form-tool");
  });

  it("lists the nine limits in the design's order, each with an Applies switch", async () => {
    await open([glm]);
    expect([...document.querySelectorAll(".setting-label")].map((label) => label.textContent)).toEqual([
      "Tokens per call",
      "Tokens per day",
      "Tokens per week",
      "Tokens per month",
      "Requests per minute",
      "Requests per day",
      "Requests per week",
      "Tokens per test",
      "Scenarios at once",
    ]);
    expect(screen.getAllByRole("switch", { name: "Applies" })).toHaveLength(9);
  });

  it("fills each limit the model has, with thousands separators, and switches it on", async () => {
    await open([glm]);
    expect(fieldOf("Tokens per call")).toHaveValue("8,000");
    expect(fieldOf("Tokens per day")).toHaveValue("200,000");
    expect(fieldOf("Tokens per month")).toHaveValue("4,000,000");
    expect(fieldOf("Requests per minute")).toHaveValue("30");
    expect(fieldOf("Requests per day")).toHaveValue("1,500");
    expect(fieldOf("Tokens per test")).toHaveValue("30,000");
    expect(fieldOf("Scenarios at once")).toHaveValue("2");
    for (const label of ["Tokens per call", "Tokens per day", "Tokens per month", "Requests per minute", "Requests per day", "Tokens per test", "Scenarios at once"]) {
      expect(switchOf(label)).toBeChecked();
    }
  });

  it("reads No limit, with the field off and the switch off, for a limit the model leaves unset", async () => {
    await open([glm]);
    for (const label of ["Tokens per week", "Requests per week"]) {
      expect(fieldOf(label)).toHaveValue("No limit");
      expect(fieldOf(label)).toBeDisabled();
      expect(switchOf(label)).not.toBeChecked();
    }
  });

  it("reads No limit on all nine when the model has none set", async () => {
    await open([{ ...glm, limits: noLimits }]);
    expect(screen.getAllByDisplayValue("No limit")).toHaveLength(9);
    expect(screen.getAllByRole("switch").filter((toggle) => (toggle as HTMLInputElement).checked)).toHaveLength(0);
  });

  it("keeps a limit of zero on, reading 0", async () => {
    await open([{ ...glm, limits: { ...noLimits, tokens_per_day: 0 } }]);
    expect(fieldOf("Tokens per day")).toHaveValue("0");
    expect(switchOf("Tokens per day")).toBeChecked();
  });

  it("saves all nine limits through the model's id when Save limits is pressed, leaving a switched-off limit null", async () => {
    await open([glm]);
    await userEvent.click(screen.getByRole("button", { name: "Save limits" }));
    expect(saveModelLimits).toHaveBeenCalledWith("h1", "c1", glm.limits);
  });

  it("saves a raised daily limit and says the limits were saved in the bar", async () => {
    await open([glm]);
    await userEvent.clear(fieldOf("Tokens per day"));
    await userEvent.type(fieldOf("Tokens per day"), "150000");
    await userEvent.click(screen.getByRole("button", { name: "Save limits" }));
    expect(saveModelLimits).toHaveBeenCalledWith("h1", "c1", savedWith({ tokens_per_day: 150000 }));
    expect(await barWith(savedText)).toHaveAttribute("role", "status");
  });

  it("saves a changed Tokens per test and Scenarios at once with the other seven as they were", async () => {
    await open([glm]);
    await retype("Tokens per test", "45000");
    await retype("Scenarios at once", "4");
    await pressSave();
    expect(saveModelLimits).toHaveBeenCalledWith("h1", "c1", savedWith({ tokens_per_test: 45000, scenarios_at_once: 4 }));
  });

  it("saves Scenarios at once as null when its switch is turned off", async () => {
    await open([glm]);
    await userEvent.click(switchOf("Scenarios at once"));
    expect(fieldOf("Scenarios at once")).toHaveValue("No limit");
    await pressSave();
    expect(saveModelLimits).toHaveBeenCalledWith("h1", "c1", savedWith({ scenarios_at_once: null }));
  });

  it("saves a limit switched off as null", async () => {
    await open([glm]);
    await userEvent.click(switchOf("Requests per minute"));
    expect(fieldOf("Requests per minute")).toHaveValue("No limit");
    await userEvent.click(screen.getByRole("button", { name: "Save limits" }));
    expect(saveModelLimits).toHaveBeenCalledWith("h1", "c1", savedWith({ requests_per_minute: null }));
  });

  it("saves a weekly limit that was off once its switch is on and a number is typed", async () => {
    await open([glm]);
    await userEvent.click(switchOf("Tokens per week"));
    await userEvent.type(fieldOf("Tokens per week"), "900000");
    await userEvent.click(screen.getByRole("button", { name: "Save limits" }));
    expect(saveModelLimits).toHaveBeenCalledWith("h1", "c1", savedWith({ tokens_per_week: 900000 }));
  });

  it("saves zero for a limit switched on and left empty", async () => {
    await open([{ ...glm, limits: noLimits }]);
    await userEvent.click(switchOf("Requests per day"));
    await userEvent.click(screen.getByRole("button", { name: "Save limits" }));
    expect(saveModelLimits).toHaveBeenCalledWith("h1", "c1", { ...noLimits, requests_per_day: 0 });
  });

  it("says the change could not be sent in a red bar when the save fails", async () => {
    await open([glm]);
    vi.mocked(saveModelLimits).mockRejectedValue(new Error("refused"));
    await userEvent.click(screen.getByRole("button", { name: "Save limits" }));
    const bar = await barWith(failedText);
    expect(bar).toHaveAttribute("role", "alert");
    expect(bar).toHaveClass("bad");
  });

  it("shows the green saved bar directly under the title row, with no status line inside the form", async () => {
    await open([glm]);
    await retype("Tokens per day", "150000");
    await pressSave();
    const bar = await barWith(savedText);
    expect(bar).toHaveClass("notice", "ok");
    expect(bar.previousElementSibling).toHaveClass("top");
    expect(document.querySelectorAll(".notice")).toHaveLength(1);
    expect(within(document.querySelector(".card") as HTMLElement).queryByRole("status")).not.toBeInTheDocument();
    expect(document.querySelector(".form-foot .foot")).toBeNull();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("shows no bar before anything is saved", async () => {
    await open([glm]);
    expect(document.querySelector(".notice")).toBeNull();
  });

  it("shows a red bar directly under the title row, keeps what was typed, and shows no green bar when the save fails", async () => {
    await open([glm]);
    vi.mocked(saveModelLimits).mockRejectedValue(new Error("refused"));
    await retype("Tokens per day", "150000");
    await pressSave();
    const bar = await barWith(failedText);
    expect(bar).toHaveClass("notice", "bad");
    expect(bar.previousElementSibling).toHaveClass("top");
    expect(screen.queryByText(savedText)).not.toBeInTheDocument();
    expect(document.querySelector(".form-foot .foot")).toBeNull();
    expect(fieldOf("Tokens per day")).toHaveValue("150,000");
  });

  it("shows one red bar and keeps the typed values when Save fails twice in a row", async () => {
    await open([glm]);
    vi.mocked(saveModelLimits).mockRejectedValue(new Error("refused"));
    await retype("Tokens per day", "150000");
    await pressSave();
    await barWith(failedText);
    await pressSave();
    await barWith(failedText);
    expect(document.querySelectorAll(".notice")).toHaveLength(1);
    expect(fieldOf("Tokens per day")).toHaveValue("150,000");
  });

  it("replaces the red bar with the green one when a save that failed is pressed again and works", async () => {
    await open([glm]);
    vi.mocked(saveModelLimits).mockRejectedValueOnce(new Error("refused"));
    await pressSave();
    await barWith(failedText);
    await pressSave();
    await barWith(savedText);
    expect(screen.queryByText(failedText)).not.toBeInTheDocument();
    expect(document.querySelectorAll(".notice")).toHaveLength(1);
  });

  it("sends one save and turns Save limits off when it is pressed again before the first answers", async () => {
    await open([glm]);
    let answer: () => void = () => {};
    vi.mocked(saveModelLimits).mockReturnValue(new Promise<void>((resolve) => (answer = resolve)));
    await pressSave();
    await pressSave();
    expect(saveModelLimits).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Save limits" })).toBeDisabled();
    await act(async () => answer());
    await barWith(savedText);
    expect(screen.getByRole("button", { name: "Save limits" })).toBeEnabled();
  });

  it("turns Save limits back on after a save that failed, and sends the next press", async () => {
    await open([glm]);
    vi.mocked(saveModelLimits).mockRejectedValueOnce(new Error("refused"));
    await pressSave();
    await barWith(failedText);
    expect(screen.getByRole("button", { name: "Save limits" })).toBeEnabled();
    await pressSave();
    expect(saveModelLimits).toHaveBeenCalledTimes(2);
  });

  it("puts the saved values back when Cancel is pressed", async () => {
    await open([glm]);
    await userEvent.clear(fieldOf("Tokens per day"));
    await userEvent.type(fieldOf("Tokens per day"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fieldOf("Tokens per day")).toHaveValue("200,000");
  });

  it("puts back the values it last saved, not the ones it was opened with", async () => {
    await open([glm]);
    await userEvent.clear(fieldOf("Tokens per day"));
    await userEvent.type(fieldOf("Tokens per day"), "150000");
    await userEvent.click(screen.getByRole("button", { name: "Save limits" }));
    await barWith(savedText);
    await userEvent.clear(fieldOf("Tokens per day"));
    await userEvent.type(fieldOf("Tokens per day"), "7");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fieldOf("Tokens per day")).toHaveValue("150,000");
  });

  it("leaves the bar it shows as it was when Cancel is pressed after a save", async () => {
    await open([glm]);
    await retype("Tokens per day", "150000");
    await pressSave();
    const bar = await barWith(savedText);
    await retype("Tokens per day", "7");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(bar).toBeInTheDocument();
    expect(document.querySelectorAll(".notice")).toHaveLength(1);
    expect(screen.getByText(savedText)).toBeInTheDocument();
  });

  it("leaves the red bar as it was when Cancel is pressed after a failed save, and puts the opened values back", async () => {
    await open([glm]);
    vi.mocked(saveModelLimits).mockRejectedValue(new Error("refused"));
    await retype("Tokens per day", "150000");
    await pressSave();
    const bar = await barWith(failedText);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(bar).toBeInTheDocument();
    expect(document.querySelectorAll(".notice")).toHaveLength(1);
    expect(fieldOf("Tokens per day")).toHaveValue("200,000");
  });

  it("shows no bar when Cancel is pressed without saving", async () => {
    await open([glm]);
    await retype("Tokens per day", "5");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fieldOf("Tokens per day")).toHaveValue("200,000");
    expect(document.querySelector(".notice")).toBeNull();
  });
});

describe("the Limits tab for a seat that is not the owner", () => {
  it("shows a Staff seat chip beside the title and offers Limits and Usage but not Key and test", async () => {
    await open([glm], staff);
    expect(screen.getByText("Staff seat")).toHaveClass("tag", "mute");
    expect(screen.queryByText("Key and test")).not.toBeInTheDocument();
    expect(screen.getByText("Limits", { selector: ".tab" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Usage" })).toBeInTheDocument();
  });

  it("shows no Staff seat chip to the owner", async () => {
    await open([glm]);
    expect(screen.queryByText("Staff seat")).not.toBeInTheDocument();
  });
});

describe("the Limits tab when the model is not found or the models cannot be read", () => {
  it("says the page could not be loaded, with a way back to Models and no tabs or form, for an address no model holds", async () => {
    await open([glm], owner, "c9");
    expect(screen.getByRole("heading", { level: 1, name: "Models" })).toBeInTheDocument();
    expect(screen.getByText("The page could not be loaded.").closest(".empty")).toHaveClass("error");
    expect(screen.getByRole("link", { name: "Back to Models" })).toHaveAttribute("href", "/h/h1/models");
    expect(document.querySelector(".tabs")).toBeNull();
    expect(screen.queryByText("ai_set_limits")).not.toBeInTheDocument();
  });

  it("says the page could not be loaded when the tools fail", async () => {
    await open(new Error('unknown tool "ai_list_accounts"'));
    expect(screen.getByText("The page could not be loaded.").closest(".empty")).toHaveClass("error");
    expect(screen.queryByText("ai_set_limits")).not.toBeInTheDocument();
  });
});

describe("the Limits tab of one model in a hub with several", () => {
  it("is titled with that model and draws its form alone, with no heading above the form", async () => {
    await open([glm, sonnet], owner, sonnet.id);
    expect(screen.getByRole("heading", { level: 1, name: "Claude · Sonnet 5.5" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(screen.getAllByText("ai_set_limits")).toHaveLength(1);
    expect(screen.getAllByDisplayValue("No limit")).toHaveLength(9);
    expect(screen.queryByDisplayValue("200,000")).not.toBeInTheDocument();
  });

  it("saves the limits of the model in the address", async () => {
    await open([glm, sonnet], owner, sonnet.id);
    await userEvent.click(screen.getByRole("button", { name: "Save limits" }));
    expect(saveModelLimits).toHaveBeenCalledTimes(1);
    expect(saveModelLimits).toHaveBeenCalledWith("h1", "c2", sonnet.limits);
  });

  it("fills the first model's own limits at its own address", async () => {
    await open([glm, sonnet], owner, glm.id);
    expect(fieldOf("Tokens per day")).toHaveValue("200,000");
    expect(screen.getAllByText("ai_set_limits")).toHaveLength(1);
  });

  it("names a model at an address it does not know Other, with the model it runs", async () => {
    await open([{ ...glm, baseUrl: "https://llm.example.org/v1", name: "Nairobi llama", modelName: "my-org/llama-4-open" }]);
    expect(screen.getByRole("heading", { level: 1, name: "Other (OpenAI-compatible) · my-org/llama-4-open" })).toBeInTheDocument();
  });
});

import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadAssistantSettings, saveAssistantSettings, type AssistantSettings } from "../../data/assistantLimits";
import { owner, renderOnPage, settle } from "../limits/harness";
import { AssistantPage } from "./AssistantPage";

vi.mock("../../data/assistantLimits", async (original) => {
  const actual = await original<typeof import("../../data/assistantLimits")>();
  return { ...actual, loadAssistantSettings: vi.fn(), saveAssistantSettings: vi.fn() };
});

const held: AssistantSettings = {
  draftId: "d1",
  roles: [
    { id: "r1", name: "Backlog member", permissions: ["task.read", "ai.chat"], may: true },
    { id: "r2", name: "Backlog worker", permissions: ["task.read"], may: false },
    { id: "r3", name: "Backlog manager", permissions: ["task.read", "ai.chat"], may: true },
  ],
  limits: { day: 20000, month: null, ownerDay: null, ownerMonth: 90000 },
  workers: { input: 500000, output: 100000, minutes: 15 },
};

const open = async (settings: AssistantSettings | Error = held) => {
  vi.mocked(loadAssistantSettings).mockReset();
  vi.mocked(saveAssistantSettings).mockReset();
  vi.mocked(saveAssistantSettings).mockResolvedValue(undefined);
  if (settings instanceof Error) vi.mocked(loadAssistantSettings).mockRejectedValue(settings);
  else vi.mocked(loadAssistantSettings).mockResolvedValue(settings);
  renderOnPage(<AssistantPage />, owner);
  await settle();
};

const rowOf = (label: string) => screen.getByText(label, { selector: ".setting-label" }).closest(".setting") as HTMLElement;
const switchOf = (label: string) => within(rowOf(label)).getByRole("switch");
const fieldOf = (label: string) => within(rowOf(label)).getByRole("textbox");
const pressSave = () => userEvent.click(screen.getByRole("button", { name: "Save" }));

describe("the console's Assistant page", () => {
  it("is titled Assistant and shows a switch for each Backlog role, on where the role may ask", async () => {
    await open();
    expect(screen.getByRole("heading", { level: 1, name: "Assistant" })).toBeInTheDocument();
    expect(switchOf("Backlog member")).toBeChecked();
    expect(switchOf("Backlog worker")).not.toBeChecked();
    expect(switchOf("Backlog manager")).toBeChecked();
  });

  it("shows the day number and the month number, a number left empty reading no limit", async () => {
    await open();
    expect(fieldOf("Tokens a day for each person")).toHaveValue("20,000");
    expect(fieldOf("Tokens a month for each person")).toHaveValue("No limit");
  });

  it("shows the owner's own day and month numbers under the people's pair, an empty one reading no limit", async () => {
    await open();
    expect(fieldOf("Tokens a day for you")).toHaveValue("No limit");
    expect(fieldOf("Tokens a month for you")).toHaveValue("90,000");
    const labels = Array.from(document.querySelectorAll(".setting-label")).map((node) => node.textContent);
    expect(labels.indexOf("Tokens a day for you")).toBeGreaterThan(labels.indexOf("Tokens a month for each person"));
  });

  it("saves the owner's numbers with the same Save", async () => {
    await open();
    await userEvent.click(within(rowOf("Tokens a day for you")).getByRole("switch"));
    await userEvent.type(fieldOf("Tokens a day for you"), "4000");
    await pressSave();
    expect(saveAssistantSettings).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveAssistantSettings).mock.calls[0][2].limits).toEqual({ day: 20000, month: null, ownerDay: 4000, ownerMonth: 90000 });
  });

  it("puts the owner's numbers back as saved when Cancel is pressed", async () => {
    await open();
    await userEvent.click(within(rowOf("Tokens a day for you")).getByRole("switch"));
    await userEvent.type(fieldOf("Tokens a day for you"), "4000");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fieldOf("Tokens a day for you")).toHaveValue("No limit");
  });

  it("saves the switches and both numbers with one press of Save", async () => {
    await open();
    await userEvent.click(switchOf("Backlog worker"));
    await userEvent.click(within(rowOf("Tokens a month for each person")).getByRole("switch"));
    await userEvent.type(fieldOf("Tokens a month for each person"), "500000");
    await pressSave();
    expect(saveAssistantSettings).toHaveBeenCalledTimes(1);
    const [hubId, before, after] = vi.mocked(saveAssistantSettings).mock.calls[0];
    expect(hubId).toBe("h1");
    expect(before).toEqual(held);
    expect(after.roles.map((role) => role.may)).toEqual([true, true, true]);
    expect(after.limits).toEqual({ day: 20000, month: 500000, ownerDay: null, ownerMonth: 90000 });
    expect(await screen.findByText("The assistant settings were saved.")).toBeInTheDocument();
  });

  it("says the switches take effect when the agency is published, after a switch was saved", async () => {
    await open();
    await userEvent.click(switchOf("Backlog worker"));
    await pressSave();
    expect(await screen.findByText("The switches take effect when the agency is published.")).toBeInTheDocument();
  });

  it("says nothing about publishing when only the numbers changed", async () => {
    await open();
    await userEvent.type(fieldOf("Tokens a day for each person"), "5");
    await pressSave();
    expect(await screen.findByText("The assistant settings were saved.")).toBeInTheDocument();
    expect(screen.queryByText("The switches take effect when the agency is published.")).not.toBeInTheDocument();
  });

  it("sends no approval card: Save writes straight away", async () => {
    await open();
    await pressSave();
    expect(saveAssistantSettings).toHaveBeenCalledTimes(1);
  });

  it("says the change could not be sent when the save fails", async () => {
    await open();
    vi.mocked(saveAssistantSettings).mockRejectedValue(new Error("no"));
    await pressSave();
    expect(await screen.findByText("The change could not be sent.")).toBeInTheDocument();
  });

  it("puts the switches back as saved when Cancel is pressed", async () => {
    await open();
    await userEvent.click(switchOf("Backlog member"));
    expect(switchOf("Backlog member")).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(switchOf("Backlog member")).toBeChecked();
  });

  it("says so when the page cannot be loaded", async () => {
    await open(new Error("down"));
    await act(settle);
    expect(screen.getByText("The page could not be loaded.")).toBeInTheDocument();
  });

  it("says no Backlog roles are in the draft when there are none", async () => {
    await open({ ...held, roles: [] });
    expect(screen.getByText("No Backlog roles are in the draft yet.")).toBeInTheDocument();
  });

  it("ends with a Workers block holding the default input tokens, output tokens and runtime in minutes", async () => {
    await open();
    expect(screen.getByText("Workers")).toBeInTheDocument();
    expect(fieldOf("Input tokens")).toHaveValue("500000");
    expect(fieldOf("Output tokens")).toHaveValue("100000");
    expect(fieldOf("Runtime in minutes")).toHaveValue("15");
    const labels = Array.from(document.querySelectorAll(".setting-label")).map((node) => node.textContent);
    expect(labels.indexOf("Input tokens")).toBeGreaterThan(labels.indexOf("Tokens a month for you"));
  });

  it("saves the changed worker numbers with the same Save", async () => {
    await open();
    await userEvent.clear(fieldOf("Input tokens"));
    await userEvent.type(fieldOf("Input tokens"), "800000");
    await userEvent.clear(fieldOf("Runtime in minutes"));
    await userEvent.type(fieldOf("Runtime in minutes"), "25");
    await pressSave();
    expect(saveAssistantSettings).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveAssistantSettings).mock.calls[0][2].workers).toEqual({ input: 800000, output: 100000, minutes: 25 });
  });

  it.each(["0", "", "abc", "1.5"])("refuses %j as a worker number in place and sends nothing", async (typed) => {
    await open();
    await userEvent.clear(fieldOf("Output tokens"));
    if (typed !== "") await userEvent.type(fieldOf("Output tokens"), typed);
    await pressSave();
    expect(within(rowOf("Output tokens")).getByText("A whole number above zero.")).toBeInTheDocument();
    expect(saveAssistantSettings).not.toHaveBeenCalled();
  });

  it("puts the worker numbers back as saved when Cancel is pressed", async () => {
    await open();
    await userEvent.clear(fieldOf("Input tokens"));
    await userEvent.type(fieldOf("Input tokens"), "7");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fieldOf("Input tokens")).toHaveValue("500000");
  });
});

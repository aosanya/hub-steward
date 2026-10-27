import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { failedText, inlineStatusLines, noticeShowing, refused, renderAgentEdit, savedText, type Replies } from "./testing";

vi.mock("../../data/agent");

const rows = [
  { key: "tokens_per_call", label: "Tokens per call", role_limit: null, ceiling: 8000, in_force: 8000, used: 0 },
  { key: "tokens_per_day", label: "Tokens per day", role_limit: 200000, ceiling: 200000, in_force: 200000, used: 1200 },
  { key: "tokens_per_week", label: "Tokens per week", role_limit: 0, ceiling: null, in_force: 0, used: 5 },
];

const open = (extra: Replies = {}) =>
  renderAgentEdit("/h/h1/agent-edit/Dispatcher/limits", {
    agentRows: { rows: [{ name: "Dispatcher", account_id: "a1", options: [] }] },
    agentLimits: { rows },
    ...extra,
  });

const rowOf = (label: string) => screen.getByText(label).closest(".setting") as HTMLElement;

describe("the Limits tab", () => {
  it("lists every limit as a settings row with the model's ceiling under its name, then the limit in force and the use so far", async () => {
    open();
    await screen.findByText("Tokens per day");
    expect(document.querySelectorAll(".settings > .setting")).toHaveLength(3);
    const day = within(rowOf("Tokens per day"));
    expect(day.getByText("model max 200,000")).toHaveClass("muted");
    expect(day.getByText("in force 200,000, used 1,200")).toBeInTheDocument();
    expect(within(rowOf("Tokens per call")).getByText("model max 8,000")).toBeInTheDocument();
  });

  it("lists the seven limits in the design's order, whatever order they arrive in", async () => {
    const keys = ["tokens_per_month", "requests_per_week", "tokens_per_call", "requests_per_day", "tokens_per_week", "requests_per_minute", "tokens_per_day"];
    const labels: Record<string, string> = {
      tokens_per_call: "Tokens per call",
      tokens_per_day: "Tokens per day",
      tokens_per_week: "Tokens per week",
      tokens_per_month: "Tokens per month",
      requests_per_minute: "Requests per minute",
      requests_per_day: "Requests per day",
      requests_per_week: "Requests per week",
    };
    open({ agentLimits: { rows: keys.map((key) => ({ key, label: labels[key], role_limit: null, ceiling: null, in_force: 0, used: 0 })) } });
    await screen.findByText("Tokens per day");
    expect([...document.querySelectorAll(".setting-label")].map((label) => label.firstChild?.textContent)).toEqual([
      "Tokens per call",
      "Tokens per day",
      "Tokens per week",
      "Tokens per month",
      "Requests per minute",
      "Requests per day",
      "Requests per week",
    ]);
  });

  it("shows no model ceiling for a limit the model does not cap", async () => {
    open();
    await screen.findByText("Tokens per week");
    expect(within(rowOf("Tokens per week")).queryByText(/model max/)).not.toBeInTheDocument();
    expect(within(rowOf("Tokens per week")).getByText("in force 0, used 5")).toBeInTheDocument();
  });

  it("says nothing about what is in force for a limit that no one sets", async () => {
    open({ agentLimits: { rows: [{ key: "tokens_per_day", label: "Tokens per day", role_limit: null, ceiling: null, in_force: 0, used: 0, source: "none" }] } });
    await screen.findByText("Tokens per day");
    expect(within(rowOf("Tokens per day")).queryByText(/in force/)).not.toBeInTheDocument();
  });

  it("names the tool the form saves through and says what zero means", async () => {
    open();
    await screen.findByText("Tokens per day");
    expect(screen.getByText("ai_set_limits")).toHaveClass("form-tool");
    expect(screen.getByText("Zero means none.")).toHaveClass("muted");
  });

  it("gives every limit an Applies switch, on where the role has a limit and off where it has none", async () => {
    open();
    await screen.findByText("Tokens per day");
    expect(screen.getAllByRole("switch", { name: "Applies" })).toHaveLength(3);
    expect(within(rowOf("Tokens per day")).getByRole("switch")).toBeChecked();
    expect(within(rowOf("Tokens per call")).getByRole("switch")).not.toBeChecked();
  });

  it("fills the number, with thousands separators, where the role has a limit, and shows No limit, off and disabled, where it has none", async () => {
    open();
    await screen.findByText("Tokens per day");
    const day = within(rowOf("Tokens per day"));
    expect(day.getByRole("textbox")).toHaveValue("200,000");
    expect(day.getByRole("textbox")).toBeEnabled();

    const call = within(rowOf("Tokens per call"));
    expect(call.getByRole("textbox")).toBeDisabled();
    expect(call.getByRole("textbox")).toHaveValue("No limit");
    expect(call.getByRole("textbox").closest(".control")).toHaveClass("off");
  });

  it("offers the default number, kept under the model's ceiling, when a limit that was off is switched on", async () => {
    open();
    await screen.findByText("Tokens per call");
    const call = within(rowOf("Tokens per call"));
    await userEvent.click(call.getByRole("switch"));
    expect(call.getByRole("textbox")).toHaveValue("8,000");
  });

  it("treats a limit of zero as one that applies, meaning none", async () => {
    open();
    await screen.findByText("Tokens per week");
    const week = within(rowOf("Tokens per week"));
    expect(week.getByRole("switch")).toBeChecked();
    expect(week.getByRole("textbox")).toHaveValue("0");
  });

  it("disables the number when Applies is switched off and enables it again, with the number it had, when it is switched on", async () => {
    open();
    await screen.findByText("Tokens per day");
    const day = within(rowOf("Tokens per day"));
    await userEvent.click(day.getByRole("switch"));
    expect(day.getByRole("textbox")).toBeDisabled();
    expect(day.getByRole("textbox")).toHaveValue("No limit");
    await userEvent.click(day.getByRole("switch"));
    expect(day.getByRole("textbox")).toBeEnabled();
    expect(day.getByRole("textbox")).toHaveValue("200,000");
  });

  it("takes only digits while it is typed in, and shows them with separators once it is left", async () => {
    open();
    await screen.findByText("Tokens per day");
    const box = within(rowOf("Tokens per day")).getByRole("textbox");
    await userEvent.clear(box);
    await userEvent.type(box, "1a5,0x0");
    expect(box).toHaveValue("1500");
    await userEvent.click(screen.getByText("Zero means none."));
    expect(box).toHaveValue("1,500");
  });

  it("saves a number for each limit that applies and null for each that does not", async () => {
    const calls = open({ saveAgentLimits: {} });
    await screen.findByText("Tokens per day");

    const call = within(rowOf("Tokens per call"));
    await userEvent.click(call.getByRole("switch"));
    await userEvent.clear(call.getByRole("textbox"));
    await userEvent.type(call.getByRole("textbox"), "4000");
    await userEvent.click(within(rowOf("Tokens per day")).getByRole("switch"));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await noticeShowing(savedText)).toHaveClass("ok");
    expect(calls.find((c) => c.fn === "saveAgentLimits")?.args).toEqual([
      "h1",
      "Dispatcher",
      { tokens_per_call: 4000, tokens_per_day: null, tokens_per_week: 0 },
    ]);
  });

  it("sends zero for an applying limit whose number was cleared", async () => {
    const calls = open({ saveAgentLimits: {} });
    await screen.findByText("Tokens per day");
    await userEvent.clear(within(rowOf("Tokens per day")).getByRole("textbox"));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await noticeShowing(savedText);
    expect(calls.find((c) => c.fn === "saveAgentLimits")?.args[2]).toMatchObject({ tokens_per_day: 0 });
  });

  it("puts every setting back as it was saved when Cancel is pressed", async () => {
    open();
    await screen.findByText("Tokens per day");
    const day = within(rowOf("Tokens per day"));
    await userEvent.clear(day.getByRole("textbox"));
    await userEvent.type(day.getByRole("textbox"), "5");
    await userEvent.click(within(rowOf("Tokens per call")).getByRole("switch"));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(day.getByRole("textbox")).toHaveValue("200,000");
    expect(within(rowOf("Tokens per call")).getByRole("switch")).not.toBeChecked();
  });

  it("puts the green bar directly under the title row and keeps no status line of its own after a save", async () => {
    open({ saveAgentLimits: {} });
    await screen.findByText("Tokens per day");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const bar = await noticeShowing(savedText);
    expect(bar).toHaveAttribute("role", "status");
    expect(bar.previousElementSibling).toHaveClass("top");
    expect(screen.getAllByText(savedText)).toHaveLength(1);
    expect(inlineStatusLines()).toHaveLength(0);
  });

  it("shows the red bar when the save is refused", async () => {
    open({ saveAgentLimits: refused() });
    await screen.findByText("Tokens per day");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const bar = await noticeShowing(failedText);
    expect(bar).toHaveClass("bad");
    expect(bar).toHaveAttribute("role", "alert");
    expect(bar.previousElementSibling).toHaveClass("top");
    expect(screen.queryByText(savedText)).not.toBeInTheDocument();
    expect(inlineStatusLines()).toHaveLength(0);
  });

  it("says the page could not be loaded when the limits fail", async () => {
    open({ agentLimits: refused() });
    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("empty", "error");
    expect(screen.getByRole("heading", { level: 1, name: "Dispatcher" })).toBeInTheDocument();
  });

  it("keeps the agent's name and the three tabs above the form, with Limits current and no button in the title row", async () => {
    open();
    await screen.findByText("Tokens per day");
    expect(screen.getByRole("link", { name: "Limits" })).toHaveAttribute("aria-current", "page");
    const title = screen.getByRole("heading", { level: 1, name: "Dispatcher" }).parentElement as HTMLElement;
    expect(within(title).queryByRole("button")).not.toBeInTheDocument();
  });
});

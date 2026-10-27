import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { failedText, inlineStatusLines, noticeShowing, refused, renderAgentEdit, savedText, type Replies } from "./testing";

vi.mock("../../data/agent");

const reply = {
  parts: [
    { source: "seat_description", text: "Takes a ride request and offers it to a rider." },
    { source: "objectives", text: "Match a ride to an available rider." },
    { source: "fine_tuning", text: "Reply in the customer's language." },
  ],
  fine_tuning: "Reply in the customer's language.",
  use_agency_instructions: true,
};

const open = (extra: Replies = {}) =>
  renderAgentEdit("/h/h1/agent-edit/Dispatcher/instructions", {
    agentRows: { rows: [{ name: "Dispatcher", account_id: "a1", options: [] }] },
    agentInstructions: reply,
    ...extra,
  });

const cardTitled = (name: string | RegExp) =>
  within(screen.getByRole("heading", { level: 2, name }).closest("section") as HTMLElement);

describe("the Instructions tab", () => {
  it("shows what the agency sends under its own heading, each part under the name of where it comes from", async () => {
    open();
    expect(await screen.findByRole("heading", { level: 2, name: "From the agency (read-only)" })).toBeInTheDocument();
    const agency = cardTitled("From the agency (read-only)");
    expect(agency.getByText("From the seat's description")).toHaveClass("field-label");
    expect(agency.getByText("Takes a ride request and offers it to a rider.")).toHaveClass("field-value");
    expect(agency.getByText("From the objectives it answers for")).toBeInTheDocument();
    expect(agency.getByText("Match a ride to an available rider.")).toBeInTheDocument();
    expect(agency.queryByText("Reply in the customer's language.")).not.toBeInTheDocument();
  });

  it("shows the fine-tuning form under Your fine-tuning, with the agency switch and the fine-tuning as saved", async () => {
    open();
    expect(await screen.findByText("Your fine-tuning")).toHaveClass("msg-title");
    expect(screen.getByLabelText("Fine-tuning")).toHaveValue("Reply in the customer's language.");
    expect(screen.getByLabelText("Use the agency's instructions")).toBeChecked();
    expect(screen.getByRole("switch", { name: "Use the agency's instructions" })).toBeInTheDocument();
    expect(screen.getByText("Nothing is recorded until you press Save.")).toHaveClass("msg-note");
  });

  it("shows the agency switch off, and says the role runs on the fine-tuning alone, when the agent does", async () => {
    open({ agentInstructions: { ...reply, parts: [reply.parts[2]], use_agency_instructions: false } });
    expect(await screen.findByLabelText("Use the agency's instructions")).not.toBeChecked();
    expect(cardTitled("From the agency (read-only)").getByText("Not used. The role runs on the fine-tuning alone.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Preview, the fine-tuning alone" })).toBeInTheDocument();
  });

  it("shows the Preview at once, the agency's words first and then the fine-tuning one line to a paragraph", async () => {
    open({ agentInstructions: { ...reply, fine_tuning: "Reply in the customer's language.\nName the rider.", parts: reply.parts.slice(0, 2) } });
    await screen.findByLabelText("Fine-tuning");
    const preview = cardTitled("Preview, both together");
    const paragraphs = preview.getAllByText(/./).filter((node) => node.tagName === "P");
    expect(paragraphs.map((node) => node.textContent)).toEqual([
      "Takes a ride request and offers it to a rider.",
      "Match a ride to an available rider.",
      "Reply in the customer's language.",
      "Name the rider.",
    ]);
    expect(paragraphs[0]).toHaveClass("soft");
    expect(paragraphs[2]).not.toHaveClass("soft");
  });

  it("changes the Preview to the fine-tuning alone, and the agency card to Not used, once the switch is turned off", async () => {
    open();
    await userEvent.click(await screen.findByLabelText("Use the agency's instructions"));
    const preview = cardTitled("Preview, the fine-tuning alone");
    expect(preview.getByText("Reply in the customer's language.")).toBeInTheDocument();
    expect(preview.queryByText("Match a ride to an available rider.")).not.toBeInTheDocument();
    expect(cardTitled("From the agency (read-only)").getByText("Not used. The role runs on the fine-tuning alone.")).toBeInTheDocument();
  });

  it("previews what was typed in the fine-tuning before it is saved", async () => {
    open();
    const box = await screen.findByLabelText("Fine-tuning");
    await userEvent.clear(box);
    await userEvent.type(box, "Be brief.");
    const preview = cardTitled("Preview, both together");
    expect(preview.getByText("Be brief.")).toBeInTheDocument();
    expect(preview.queryByText("Reply in the customer's language.")).not.toBeInTheDocument();
  });

  it("does not repeat the saved fine-tuning that the agency sends along with its parts", async () => {
    open();
    await screen.findByLabelText("Fine-tuning");
    expect(cardTitled("Preview, both together").getAllByText("Reply in the customer's language.")).toHaveLength(1);
  });

  it("says the agency has no instructions for the role when the switch is on and none came", async () => {
    open({ agentInstructions: { ...reply, parts: [reply.parts[2]] } });
    await screen.findByLabelText("Fine-tuning");
    expect(cardTitled("From the agency (read-only)").getByText("The agency has no instructions for this role.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Preview, the fine-tuning alone" })).toBeInTheDocument();
  });

  it("saves the fine-tuning and the agency switch and says so in the green bar under the title", async () => {
    const calls = open({ saveAgentInstructions: {} });
    const box = await screen.findByLabelText("Fine-tuning");
    await userEvent.clear(box);
    await userEvent.type(box, "Be brief.");
    await userEvent.click(screen.getByLabelText("Use the agency's instructions"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await noticeShowing(savedText)).toHaveClass("ok");
    expect(calls.find((c) => c.fn === "saveAgentInstructions")?.args).toEqual([
      "h1",
      "Dispatcher",
      { fine_tuning: "Be brief.", use_agency_instructions: false },
    ]);
  });

  it("puts the fine-tuning and the switch back as they were saved when Cancel is pressed", async () => {
    open();
    const box = await screen.findByLabelText("Fine-tuning");
    await userEvent.clear(box);
    await userEvent.type(box, "Be brief.");
    await userEvent.click(screen.getByLabelText("Use the agency's instructions"));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(box).toHaveValue("Reply in the customer's language.");
    expect(screen.getByLabelText("Use the agency's instructions")).toBeChecked();
  });

  it("puts the green bar directly under the title row and keeps no status line of its own after a save", async () => {
    open({ saveAgentInstructions: {} });
    await screen.findByLabelText("Fine-tuning");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const bar = await noticeShowing(savedText);
    expect(bar).toHaveAttribute("role", "status");
    expect(bar.previousElementSibling).toHaveClass("top");
    expect(screen.getAllByText(savedText)).toHaveLength(1);
    expect(inlineStatusLines()).toHaveLength(0);
  });

  it("shows the red bar when the save is refused", async () => {
    open({ saveAgentInstructions: refused() });
    await screen.findByLabelText("Fine-tuning");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const bar = await noticeShowing(failedText);
    expect(bar).toHaveClass("bad");
    expect(bar).toHaveAttribute("role", "alert");
    expect(bar.previousElementSibling).toHaveClass("top");
    expect(screen.queryByText(savedText)).not.toBeInTheDocument();
    expect(inlineStatusLines()).toHaveLength(0);
  });

  it("says the page could not be loaded when the instructions fail", async () => {
    open({ agentInstructions: refused() });
    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("empty", "error");
    expect(screen.getByRole("heading", { level: 1, name: "Dispatcher" })).toBeInTheDocument();
  });

  it("keeps the three tabs above the form with Instructions current, and no button in the title row", async () => {
    open();
    await screen.findByLabelText("Fine-tuning");
    expect(screen.getByRole("link", { name: "Instructions" })).toHaveAttribute("aria-current", "page");
    const title = screen.getByRole("heading", { level: 1, name: "Dispatcher" }).parentElement as HTMLElement;
    expect(within(title).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("the earlier versions of the instructions", () => {
  const saved = [
    { id: "r2", created_at: "2026-10-27 09:12", created_by: "Amos" },
    { id: "r1", at: "2026-10-26 17:40", by: "Grace" },
  ];
  const show = "Show the earlier versions";

  it("asks for the versions only when Show the earlier versions is pressed", async () => {
    const calls = open({ agentRevisions: { rows: saved } });
    await screen.findByLabelText("Fine-tuning");
    expect(calls.some((c) => c.fn === "agentRevisions")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: show }));
    expect(await screen.findByText("Amos, 2026-10-27 09:12")).toBeInTheDocument();
    expect(calls.filter((c) => c.fn === "agentRevisions")).toEqual([{ fn: "agentRevisions", args: ["h1", "Dispatcher"] }]);
  });

  it("shows the versions as the answer to that question, and Clear takes them away and brings the button back", async () => {
    open({ agentRevisions: { rows: saved } });
    await userEvent.click(await screen.findByRole("button", { name: show }));
    const answer = await screen.findByRole("region", { name: "Answer from the chat" });
    expect(within(answer).getByText("Answer to:")).toBeInTheDocument();
    expect(within(answer).getByText(show)).toBeInTheDocument();
    expect(within(answer).getByText("Amos, 2026-10-27 09:12")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: show })).not.toBeInTheDocument();

    await userEvent.click(within(answer).getByRole("button", { name: "Clear" }));
    expect(screen.queryByText("Amos, 2026-10-27 09:12")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: show })).toBeInTheDocument();
  });

  it("shows who and when from the names the AI backend sends, saved_by and saved_at", async () => {
    open({ agentRevisions: { rows: [{ id: "r9", saved_at: "2026-10-27 11:30", saved_by: "Wanjiru" }] } });
    await screen.findByLabelText("Fine-tuning");
    await userEvent.click(screen.getByRole("button", { name: show }));
    expect(await screen.findByText("Wanjiru, 2026-10-27 11:30")).toBeInTheDocument();
  });

  it("lists each version, newest first, as Version N with who and when under Saved, reading either spelling of the two fields, and a Restore button each", async () => {
    open({ agentRevisions: { rows: saved } });
    await userEvent.click(await screen.findByRole("button", { name: show }));
    expect(await screen.findByText("Amos, 2026-10-27 09:12")).toBeInTheDocument();
    expect(screen.getByText("Grace, 2026-10-26 17:40")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Version", "Saved", ""]);
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Version 2")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Version 1")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Restore" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Restore" })[0]).toHaveClass("quiet", "sm");
  });

  it("says there are no earlier versions yet when the list is empty", async () => {
    open({ agentRevisions: { rows: [] } });
    await userEvent.click(await screen.findByRole("button", { name: show }));
    expect(await screen.findByText("No earlier versions yet")).toHaveClass("empty");
  });

  it("says the page could not be loaded when the list fails", async () => {
    open({ agentRevisions: refused() });
    await userEvent.click(await screen.findByRole("button", { name: show }));
    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("empty", "error");
  });

  it("restores a version and then shows the instructions as they were restored", async () => {
    let current = reply;
    const calls = open({
      agentInstructions: () => current,
      agentRevisions: { rows: saved },
      restoreAgentRevision: () => {
        current = { ...reply, fine_tuning: "The older fine-tuning." };
        return {};
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: show }));
    await screen.findByText("Grace, 2026-10-26 17:40");
    await userEvent.click(screen.getAllByRole("button", { name: "Restore" })[1]);

    await waitFor(() => expect(screen.getByLabelText("Fine-tuning")).toHaveValue("The older fine-tuning."));
    expect(calls.filter((c) => c.fn === "restoreAgentRevision")).toEqual([
      { fn: "restoreAgentRevision", args: ["h1", "Dispatcher", "r1"] },
    ]);
    expect(calls.filter((c) => c.fn === "agentInstructions")).toHaveLength(2);
    expect(screen.queryByText("Grace, 2026-10-26 17:40")).not.toBeInTheDocument();
  });

  it("shows the red bar when a restore is refused, and leaves the page as it was", async () => {
    const calls = open({
      agentRevisions: { rows: saved },
      restoreAgentRevision: refused(),
    });
    await userEvent.click(await screen.findByRole("button", { name: show }));
    await screen.findByText("Amos, 2026-10-27 09:12");
    await userEvent.click(screen.getAllByRole("button", { name: "Restore" })[0]);

    const bar = await noticeShowing(failedText);
    expect(bar).toHaveClass("bad");
    expect(bar).toHaveAttribute("role", "alert");
    expect(bar.previousElementSibling).toHaveClass("top");
    expect(inlineStatusLines()).toHaveLength(0);
    expect(screen.getByText("Amos, 2026-10-27 09:12")).toBeInTheDocument();
    expect(calls.filter((c) => c.fn === "restoreAgentRevision")[0].args).toEqual(["h1", "Dispatcher", "r2"]);
    expect(calls.filter((c) => c.fn === "agentInstructions")).toHaveLength(1);
  });
});

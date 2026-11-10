import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { routes } from "../routes";
import { AssistantPage } from "./AssistantPage";
import { systemPrompt, type AssistantClient } from "./api";
import { splitOptions } from "./optionLines";
import { manyMatchesRule, pageLines } from "./triager";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

describe("the assistant's instruction", () => {
  it("asks one short question with options before any tool when the ask is vague, calls the tool at once when it is clear, and makes one pending call with q for a bare word", () => {
    expect(systemPrompt).toContain("vague");
    expect(systemPrompt).toContain("call no tool");
    expect(systemPrompt).toContain("one short question");
    expect(systemPrompt).toContain("[[option]]");
    expect(systemPrompt).toContain("For a clear ask call the tool at once");
    expect(systemPrompt).toContain("one taskmanager_task_pending call with q");
    expect(systemPrompt).toContain("never several guessed calls");
  });

  it("tells the model what to do when seven or more issues match: a few readings as option lines, never the titles, and a narrower word", () => {
    expect(systemPrompt).toContain(manyMatchesRule);
    expect(pageLines).toContain(manyMatchesRule);
  });

  it("says so in one sentence when a result is empty", () => {
    expect(systemPrompt).toContain("When a result is empty, say so in one sentence");
  });
});

describe("options in an answer", () => {
  it("are the lines written as [[option]], and the rest stays the text", () => {
    expect(splitOptions("Which do you mean?\n[[Issues tagged shoe]]\n[[Issues with shoe in the title]]\n")).toEqual({ text: "Which do you mean?", options: ["Issues tagged shoe", "Issues with shoe in the title"] });
    expect(splitOptions("Nothing here.")).toEqual({ text: "Nothing here.", options: [] });
  });

  it("are one button each when the model writes several markers on one line", () => {
    expect(splitOptions("Which do you mean?\n[[Issues tagged shoe]] [[Issues with shoe in the title]]  [[A repo called shoe]]")).toEqual({
      text: "Which do you mean?",
      options: ["Issues tagged shoe", "Issues with shoe in the title", "A repo called shoe"],
    });
  });

  it("stay words when a marker sits inside a sentence", () => {
    expect(splitOptions("Try [[this]] one")).toEqual({ text: "Try [[this]] one", options: [] });
  });
});

const show = (client: AssistantClient) =>
  render(
    <MemoryRouter initialEntries={["/a/farmers/chat/assistant"]}>
      <Routes>
        <Route path={routes.assistant.pattern} element={<AssistantPage client={client} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("the option buttons on the assistant page", () => {
  it("show the readings as quiet buttons and send the chosen one as the next message", async () => {
    const ask = vi
      .fn()
      .mockResolvedValueOnce({ text: "Which do you mean?\n[[Issues tagged shoe]]\n[[Issues with shoe in the title]]", lists: [] })
      .mockResolvedValueOnce({ text: "3 issues are tagged shoe.", lists: [] });
    show({ model: async () => "acc1", ask });
    await userEvent.type(await screen.findByRole("textbox"), "shoe");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Which do you mean?")).toBeInTheDocument();
    expect(screen.queryByText(/\[\[/)).toBeNull();
    const pick = await screen.findByRole("button", { name: "Issues tagged shoe" });
    expect(pick).toHaveClass("btn", "quiet");
    expect(screen.getByRole("button", { name: "Issues with shoe in the title" })).toBeInTheDocument();
    await userEvent.click(pick);
    expect(await screen.findByText("3 issues are tagged shoe.")).toBeInTheDocument();
    expect(ask).toHaveBeenCalledTimes(2);
    expect(ask.mock.calls[1][1].map((turn: { role: string; content: string }) => turn.content)).toEqual([
      "shoe",
      "Which do you mean?\n[[Issues tagged shoe]]\n[[Issues with shoe in the title]]",
      "Issues tagged shoe",
    ]);
    expect(screen.queryByRole("button", { name: "Issues tagged shoe" })).toBeNull();
  });
});

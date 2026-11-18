import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OptionButtons } from "./OptionButtons";
import { residentChoices, residentPrompt } from "./residentReads";

const about = { kind: "resident" as const, id: "r1", name: "Takács Erzsébet" };

describe("the line that invites a pick", () => {
  it("tells the model to ask what to see about the resident, to tap one or write a question, with the four choices", () => {
    const prompt = residentPrompt(about);
    expect(prompt).toContain("What would you like to see about Takács Erzsébet? Tap one, or write your question.");
    for (const choice of residentChoices) expect(prompt).toContain(`[[${choice}]]`);
  });
});

describe("a general question about the resident", () => {
  it("is answered from all four reads with counts and the most recent item of each, then the choices, and never the same greeting twice", () => {
    const prompt = residentPrompt(about);
    expect(prompt).toMatch(/tell me about|what do you know|summary/i);
    expect(prompt).toMatch(/all four reads/i);
    expect(prompt).toMatch(/count/i);
    expect(prompt).toMatch(/most recent/i);
    expect(prompt).toMatch(/nothing on file/i);
    expect(prompt).toMatch(/never (?:write|give|repeat)[^.]*(?:twice|same)/i);
  });
});

describe("the choices", () => {
  it("are buttons with the option as their name, a chevron that is hidden from readers, and a stack that looks pressable", async () => {
    const picked: string[] = [];
    render(<OptionButtons options={residentChoices} onPick={(option) => picked.push(option)} />);
    for (const choice of residentChoices) expect(screen.getByRole("button", { name: choice })).toBeInTheDocument();
    expect(document.querySelector(".rm-btns.rm-choices")).not.toBeNull();
    expect(document.querySelectorAll(".rm-choices .btn .chev[aria-hidden='true']")).toHaveLength(residentChoices.length);
    await userEvent.click(screen.getByRole("button", { name: "Holdings" }));
    expect(picked).toEqual(["Holdings"]);
  });

  it("are drawn square, accent and bold, one under another with a gap", () => {
    const css = readFileSync("src/features/assistant/assistant.css", "utf8");
    expect(css).toMatch(/\.rm-choices \{[^}]*flex-direction: column/);
    expect(css).toMatch(/\.rm-choices \{[^}]*gap:/);
    expect(css).toMatch(/\.rm-choices \.btn \{[^}]*color: var\(--accent\)/);
    expect(css).toMatch(/\.rm-choices \.btn \{[^}]*font-weight: 700/);
    expect(css).toMatch(/\.rm-choices \.btn \{[^}]*border-radius: 0/);
  });
});

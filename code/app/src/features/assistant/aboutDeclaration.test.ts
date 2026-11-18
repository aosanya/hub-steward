import type { ChatAbout } from "../../app/chatAbout";
import { aboutLabel, choicesFor, emptyWordsFor, placeholderFor, promptFor, readNamesFor, readsWordsFor, scopedArgs, stepWordsFor } from "./aboutSubjects";

const declaration: ChatAbout = { kind: "declaration", id: "d1", name: "Zsofia Varga" };

describe("the declaration subject", () => {
  it("reads only the declarations the person may already see, and adds no scope the tool does not take", () => {
    expect(readNamesFor(declaration)).toEqual(["agency_list_declarations"]);
    expect(scopedArgs(declaration, "agency_list_declarations", {})).toEqual({});
  });

  it("gives its read a step word and names the member in its own words", () => {
    expect(stepWordsFor(declaration).agency_list_declarations).toBeTruthy();
    expect(aboutLabel(declaration)).toBe("Zsofia Varga");
    expect(placeholderFor(declaration)).toBe("Ask about Zsofia Varga");
  });

  it("offers the declaration as its one choice and says what it is for the empty state", () => {
    expect(choicesFor(declaration)).toEqual(["Declaration"]);
    expect(emptyWordsFor(declaration)).toBe("Ask about Zsofia Varga: what they declared.");
    expect(readsWordsFor(declaration)).toContain("this declaration of interest");
  });

  it("tells the assistant which row is the one on the screen, by its id, and keeps the backlog out", () => {
    const prompt = promptFor(declaration);
    expect(prompt).toContain("What would you like to see about Zsofia Varga? Tap one, or write your question.");
    expect(prompt).toContain("[[Declaration]]");
    expect(prompt).toContain("row_id");
    expect(prompt).not.toMatch(/backlog/i);
    expect(prompt).toContain("If a tool call failed or was refused, say you could not read it.");
  });
});

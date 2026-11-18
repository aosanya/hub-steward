import type { ChatAbout } from "../../app/chatAbout";
import { aboutLabel, choicesFor, emptyWordsFor, promptFor, readNamesFor, scopeKeysFor, scopedArgs, stepWordsFor } from "./aboutSubjects";

const issue: ChatAbout = { kind: "issue", id: "i1", name: "Sample street light out", extra: { board: "w1", details: "Status: open. Department: Sample Works. Place: Sample Street, Sample Ward" } };

const wish: ChatAbout = { kind: "wish", id: "w1", name: "A bench by the bus stop" };

describe("the issue subject", () => {
  it("reads the replies on its own issue and the wish it is grouped under", () => {
    expect(readNamesFor(issue)).toEqual(["forms_catalog_reply_list", "forms_catalog_board_item_read"]);
    expect(scopedArgs(issue, "forms_catalog_reply_list", {})).toEqual({ raisedItemID: "i1" });
    expect(scopedArgs(issue, "forms_catalog_board_item_read", {})).toEqual({ boardItemID: "w1" });
    expect(scopeKeysFor(issue, "forms_catalog_reply_list")).toEqual(["raisedItemID"]);
  });

  it("gives every read a step word and names the subject by its title", () => {
    for (const name of readNamesFor(issue)) expect(stepWordsFor(issue)[name]).toBeTruthy();
    expect(aboutLabel(issue)).toBe("Sample street light out");
    expect(emptyWordsFor(issue)).toContain("Sample street light out");
  });

  it("offers Details and Replies, hands over the page facts and never names who raised it", () => {
    expect(choicesFor(issue)).toEqual(["Details", "Replies"]);
    const prompt = promptFor(issue);
    expect(prompt).toContain("forms_catalog_reply_list");
    expect(prompt).toContain("Department: Sample Works");
    expect(prompt).toMatch(/never say who raised it/i);
    expect(prompt).not.toMatch(/backlog/i);
  });
});

describe("the wish subject", () => {
  it("reads its own board item and counts its Me too", () => {
    expect(readNamesFor(wish)).toEqual(["forms_catalog_board_item_read", "forms_catalog_endorsement_count"]);
    expect(scopedArgs(wish, "forms_catalog_board_item_read", {})).toEqual({ boardItemID: "w1" });
    expect(scopedArgs(wish, "forms_catalog_endorsement_count", {})).toEqual({ subject_id: "w1" });
  });

  it("gives every read a step word and names the subject by its title", () => {
    for (const name of readNamesFor(wish)) expect(stepWordsFor(wish)[name]).toBeTruthy();
    expect(aboutLabel(wish)).toBe("A bench by the bus stop");
  });

  it("offers Details, Raised by and Said Me too", () => {
    expect(choicesFor(wish)).toEqual(["Details", "Raised by", "Said Me too"]);
    const prompt = promptFor(wish);
    expect(prompt).toContain("forms_catalog_board_item_read");
    expect(prompt).toContain("forms_catalog_endorsement_count");
    expect(prompt).not.toMatch(/backlog/i);
  });
});

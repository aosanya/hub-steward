import type { ChatAbout } from "../../app/chatAbout";
import { aboutLabel, choicesFor, emptyWordsFor, placeholderFor, promptFor, readNamesFor, readsWordsFor, scopeKeysFor, scopedArgs, stepWordsFor } from "./aboutSubjects";

const meeting: ChatAbout = { kind: "meeting", id: "m1", name: "Spring Budget Meeting" };
const resolution: ChatAbout = { kind: "resolution", id: "r1", name: "Approve the spring budget", extra: { meeting: "m1" } };
const bylaw: ChatAbout = { kind: "bylaw", id: "b1", name: "Market stall fees" };
const committee: ChatAbout = { kind: "committee", id: "g1", name: "Sample Finance Committee" };

const all = [meeting, resolution, bylaw, committee];

describe("the council subjects", () => {
  it("a meeting reads its record, agenda, minutes and resolutions, scoped to itself", () => {
    expect(readNamesFor(meeting)).toEqual(["council_meeting_read", "council_agenda_read", "council_minutes_read", "council_resolution_list"]);
    expect(scopedArgs(meeting, "council_meeting_read", {})).toEqual({ meetingID: "m1" });
    expect(scopedArgs(meeting, "council_agenda_read", {})).toEqual({ meetingID: "m1" });
    expect(scopedArgs(meeting, "council_minutes_read", {})).toEqual({ meetingID: "m1" });
    expect(scopedArgs(meeting, "council_resolution_list", {})).toEqual({ meeting_id: "m1" });
    expect(scopeKeysFor(meeting, "council_resolution_list")).toEqual(["meeting_id"]);
  });

  it("a resolution reads its own record and the meeting it was passed at", () => {
    expect(readNamesFor(resolution)).toEqual(["council_resolution_read", "council_meeting_read"]);
    expect(scopedArgs(resolution, "council_resolution_read", {})).toEqual({ resolutionID: "r1" });
    expect(scopedArgs(resolution, "council_meeting_read", {})).toEqual({ meetingID: "m1" });
  });

  it("a resolution with no meeting scopes the meeting read to none, which returns nothing", () => {
    const loose: ChatAbout = { kind: "resolution", id: "r2", name: "Loose", extra: {} };
    expect(scopedArgs(loose, "council_meeting_read", {})).toEqual({ meetingID: "" });
  });

  it("a bylaw reads only its own record", () => {
    expect(readNamesFor(bylaw)).toEqual(["council_bylaw_read"]);
    expect(scopedArgs(bylaw, "council_bylaw_read", {})).toEqual({ bylawID: "b1" });
  });

  it("a committee reads its group and its seats, scoped to its group", () => {
    expect(readNamesFor(committee)).toEqual(["actor_get_group", "actor_list_role_assignments_for_group"]);
    expect(scopedArgs(committee, "actor_get_group", {})).toEqual({ group_id: "g1" });
    expect(scopedArgs(committee, "actor_list_role_assignments_for_group", { active_only: true })).toEqual({ active_only: true, group_id: "g1" });
    expect(scopeKeysFor(committee, "actor_list_role_assignments_for_group")).toEqual(["group_id"]);
  });

  it("gives every read a step word and names the subject in its own words", () => {
    for (const about of all) {
      for (const name of readNamesFor(about)) expect(stepWordsFor(about)[name]).toBeTruthy();
      expect(aboutLabel(about)).toBe(about.name);
      expect(placeholderFor(about)).toBe(`Ask about ${about.name}`);
    }
  });

  it("offers the choices of the kind", () => {
    expect(choicesFor(meeting)).toEqual(["Details", "Agenda", "Minutes", "Resolutions"]);
    expect(choicesFor(resolution)).toEqual(["Details"]);
    expect(choicesFor(bylaw)).toEqual(["Text"]);
    expect(choicesFor(committee)).toEqual(["Details", "Members"]);
  });

  it("invites the owner, offers the choices and keeps the backlog out of the prompt", () => {
    for (const about of all) {
      const prompt = promptFor(about);
      expect(prompt).toContain(`What would you like to see about ${about.name}? Tap one, or write your question.`);
      for (const choice of choicesFor(about)) expect(prompt).toContain(`[[${choice}]]`);
      expect(prompt).not.toMatch(/backlog/i);
    }
  });

  it("names the subject in the empty state and in the reads words", () => {
    expect(emptyWordsFor(meeting)).toBe("Ask about Spring Budget Meeting: its details, agenda, minutes and resolutions.");
    expect(emptyWordsFor(resolution)).toBe("Ask about Approve the spring budget: its details and the meeting it was passed at.");
    expect(emptyWordsFor(bylaw)).toBe("Ask about Market stall fees: its text.");
    expect(emptyWordsFor(committee)).toBe("Ask about Sample Finance Committee: its details and members.");
    expect(readsWordsFor(meeting)).toContain("this meeting");
    expect(readsWordsFor(resolution)).toContain("this resolution");
    expect(readsWordsFor(bylaw)).toContain("this bylaw");
    expect(readsWordsFor(committee)).toContain("this committee");
  });

  it("tells the assistant a refused read is said for that read", () => {
    for (const about of all) expect(promptFor(about)).toContain("If a tool call failed or was refused, say you could not read it.");
  });
});

import type { ChatAbout } from "../../app/chatAbout";
import { promptFor, readNamesFor, scopeKeysFor, scopedArgs, stepWordsFor } from "./aboutSubjects";

const user: ChatAbout = { kind: "user", id: "u1", name: "Asha Otieno" };
const business: ChatAbout = { kind: "business", id: "row7", name: "Szabó Pékség", extra: { owner: "o1" } };

describe("the chat about a user reads what was done to them and what they did", () => {
  it("keeps the audit read open to both the subject and the actor", () => {
    expect(readNamesFor(user)).toContain("audit_list_entries");
    expect(scopeKeysFor(user, "audit_list_entries")).toEqual([]);
  });

  it("reads by subject when the model names nothing, as before", () => {
    expect(scopedArgs(user, "audit_list_entries", {})).toEqual({ subject: "u1" });
  });

  it("reads by actor, with the user's own id, when the model asks for what the person did", () => {
    expect(scopedArgs(user, "audit_list_entries", { actor: "anything" })).toEqual({ actor: "u1" });
  });

  it("reads by subject, with the user's own id, when the model asks for what was done to them", () => {
    expect(scopedArgs(user, "audit_list_entries", { subject: "anything" })).toEqual({ subject: "u1" });
  });

  it("never reads both at once and keeps the other arguments", () => {
    expect(scopedArgs(user, "audit_list_entries", { actor: "a", subject: "b", limit: 5 })).toEqual({ subject: "u1", limit: 5 });
    expect(scopedArgs(user, "audit_list_entries", { actor: "a", limit: 5 })).toEqual({ actor: "u1", limit: 5 });
  });

  it("tells the model both sides of the activity", () => {
    const prompt = promptFor(user);
    expect(prompt).toContain("actor");
    expect(prompt).toContain("subject");
    expect(stepWordsFor(user).audit_list_entries).toBeTruthy();
  });

  it("leaves the other kinds alone", () => {
    expect(scopeKeysFor(business, "audit_list_entries")).toEqual(["subject"]);
    expect(scopedArgs(business, "audit_list_entries", { actor: "x" })).toEqual({ actor: "x", subject: "row7" });
  });
});

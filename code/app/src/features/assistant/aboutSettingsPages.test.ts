import type { ChatAbout } from "../../app/chatAbout";
import { choicesFor, emptyWordsFor, promptFor, readNamesFor, scopedArgs, stepWordsFor } from "./aboutSubjects";

const entry: ChatAbout = { kind: "audit-entry", id: "e1", name: "granted a role: Bela Nagy", extra: { subject: "a2", details: "Asha Otieno · 12 Nov 2026" } };
const entryWithoutSubject: ChatAbout = { kind: "audit-entry", id: "e3", name: "added a row", extra: { subject: "e3", details: "Asha Otieno · 10 Nov 2026" } };
const agency: ChatAbout = { kind: "agency", id: "town", name: "Riverside Office" };
const details: ChatAbout = { kind: "record-details", id: "RC-1", name: "Businesses", extra: { details: "Trading name (on, required); Tax number (on)" } };

describe("the chat about an audit entry", () => {
  it("reads only the audit log, narrowed to the entry's own subject", () => {
    expect(readNamesFor(entry)).toEqual(["audit_list_entries"]);
    expect(scopedArgs(entry, "audit_list_entries", { subject: "anything", actor: "someone", limit: 5 })).toEqual({ subject: "a2", actor: "someone", limit: 5 });
  });

  it("narrows to nothing, never to everything, when the entry has no subject of its own", () => {
    expect(scopedArgs(entryWithoutSubject, "audit_list_entries", {})).toEqual({ subject: "e3" });
  });

  it("offers the choices that fit and says what it is about, with who did it given in the conversation", () => {
    expect(choicesFor(entry)).toEqual(["Who did this?", "What else happened to it?"]);
    const prompt = promptFor(entry);
    expect(prompt).toContain("about one thing, granted a role: Bela Nagy.");
    expect(prompt).toContain("Asha Otieno · 12 Nov 2026");
    expect(stepWordsFor(entry).audit_list_entries).toBeTruthy();
    expect(emptyWordsFor(entry)).toContain("granted a role: Bela Nagy");
  });
});

describe("the chat about the agency", () => {
  it("reads the agency and its languages and nothing else, with no argument to widen them", () => {
    expect(readNamesFor(agency)).toEqual(["agency_get_agency", "instance_get_languages"]);
    expect(scopedArgs(agency, "agency_get_agency", { id: "other" })).toEqual({ id: "other" });
  });

  it("offers the choices that fit and tells the model to state no key or secret", () => {
    expect(choicesFor(agency)).toEqual(["Details", "What languages are on?"]);
    const prompt = promptFor(agency);
    expect(prompt).toContain("about one thing, Riverside Office.");
    expect(prompt).toMatch(/never state a key or a secret/i);
    expect(stepWordsFor(agency).instance_get_languages).toBeTruthy();
  });
});

describe("the chat about the details of a record", () => {
  it("reads the saved details of that record and the registers, pinning the setting key to the record", () => {
    expect(readNamesFor(details)).toEqual(["forms_catalog_setting_read", "agency_list_live_records"]);
    expect(scopedArgs(details, "forms_catalog_setting_read", { key: "register_details:RC-9" })).toEqual({ key: "register_details:RC-1" });
  });

  it("offers the choices that fit and gives the details on the page in the conversation", () => {
    expect(choicesFor(details)).toEqual(["Which details are on?", "Which details are required?"]);
    const prompt = promptFor(details);
    expect(prompt).toContain("about one thing, Businesses.");
    expect(prompt).toContain("Trading name (on, required); Tax number (on)");
    expect(stepWordsFor(details).forms_catalog_setting_read).toBeTruthy();
  });
});

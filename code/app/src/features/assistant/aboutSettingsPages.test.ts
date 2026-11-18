import type { ChatAbout } from "../../app/chatAbout";
import { choicesFor, promptFor, readNamesFor, scopedArgs, stepWordsFor } from "./aboutSubjects";

const agency: ChatAbout = { kind: "agency", id: "town", name: "Riverside Office" };
const details: ChatAbout = { kind: "record-details", id: "RC-1", name: "Businesses", extra: { details: "Trading name (on, required); Tax number (on)" } };

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

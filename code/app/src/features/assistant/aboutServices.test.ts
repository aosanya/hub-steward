import type { ChatAbout } from "../../app/chatAbout";
import { aboutLabel, choicesFor, emptyWordsFor, placeholderFor, promptFor, readNamesFor, readsWordsFor, scopeKeysFor, scopedArgs, stepWordsFor } from "./aboutSubjects";

const application: ChatAbout = { kind: "application", id: "f1", name: "Market stall application" };
const permit: ChatAbout = { kind: "permit", id: "market-stall-permit", name: "Market Stall Permit", extra: { form: "f1" } };
const licence: ChatAbout = { kind: "licence", id: "dog-licence", name: "Dog Licence", extra: { form: "f3" } };
const fee: ChatAbout = { kind: "fee", id: "hall-hire-fee", name: "Hall Hire Fee", extra: { form: "f4", payer: "m1" } };
const service: ChatAbout = { kind: "service", id: "bulk-waste", name: "Bulk Waste Collection" };

const all = [application, permit, licence, fee, service];

describe("an application is a subject of its own", () => {
  it("reads the send, its questions and its answers, scoped to its form", () => {
    expect(readNamesFor(application)).toEqual(["forms_submission_read_mine", "forms_question_list", "forms_answer_list"]);
    for (const tool of readNamesFor(application)) {
      expect(scopedArgs(application, tool, {})).toEqual({ form_id: "f1" });
      expect(scopeKeysFor(application, tool)).toEqual(["form_id"]);
    }
    expect(scopedArgs(application, "forms_answer_list", { form_id: "other" })).toEqual({ form_id: "f1" });
  });

  it("offers Answers, Decision and Status", () => {
    expect(choicesFor(application)).toEqual(["Answers", "Decision", "Status"]);
    expect(promptFor(application)).toContain("forms_question_list");
    expect(promptFor(application)).toContain("forms_submission_read_mine");
  });
});

describe("a permit and a licence read the entry, the person's sends and the received applications", () => {
  it("scopes each read to the entry's slug or its form", () => {
    for (const about of [permit, licence]) {
      expect(readNamesFor(about)).toEqual(["forms_catalog_entry_read", "forms_catalog_entry_submissions_mine", "forms_submission_list"]);
      expect(scopedArgs(about, "forms_catalog_entry_read", {})).toEqual({ slug: about.id });
      expect(scopedArgs(about, "forms_catalog_entry_submissions_mine", {})).toEqual({ slug: about.id });
      expect(scopedArgs(about, "forms_submission_list", {})).toEqual({ form_id: about.extra?.form });
      expect(scopeKeysFor(about, "forms_submission_list")).toEqual(["form_id"]);
    }
  });

  it("offers Applications, Granted and Dates", () => {
    expect(choicesFor(permit)).toEqual(["Applications", "Granted", "Dates"]);
    expect(choicesFor(licence)).toEqual(["Applications", "Granted", "Dates"]);
  });
});

describe("a fee reads the entry, the send, the form's amount and the payer's name", () => {
  it("scopes the reads to the entry, its form and the payer", () => {
    expect(readNamesFor(fee)).toEqual(["forms_catalog_entry_read", "forms_catalog_entry_submissions_mine", "forms_form_read", "actor_get_actor"]);
    expect(scopedArgs(fee, "forms_catalog_entry_read", {})).toEqual({ slug: "hall-hire-fee" });
    expect(scopedArgs(fee, "forms_form_read", {})).toEqual({ form_id: "f4" });
    expect(scopedArgs(fee, "actor_get_actor", {})).toEqual({ actor_id: "m1" });
  });

  it("offers Amount, Payer and Paid", () => {
    expect(choicesFor(fee)).toEqual(["Amount", "Payer", "Paid"]);
  });
});

describe("a service reads its catalogue entry", () => {
  it("reads only the entry, scoped to its slug, and offers Summary and Form", () => {
    expect(readNamesFor(service)).toEqual(["forms_catalog_entry_read"]);
    expect(scopedArgs(service, "forms_catalog_entry_read", {})).toEqual({ slug: "bulk-waste" });
    expect(choicesFor(service)).toEqual(["Summary", "Form"]);
  });
});

describe("every services subject follows the shared rules", () => {
  it("names the item in the About line, the placeholder and the empty state", () => {
    expect(aboutLabel(permit)).toBe("Market Stall Permit");
    expect(placeholderFor(permit)).toBe("Ask about Market Stall Permit");
    for (const about of all) expect(emptyWordsFor(about)).toContain(`Ask about ${about.name}:`);
  });

  it("gives every read a step word", () => {
    for (const about of all) for (const name of readNamesFor(about)) expect(stepWordsFor(about)[name]).toBeTruthy();
  });

  it("asks to tap one or write a question, with the choices, and keeps the backlog out", () => {
    for (const about of all) {
      const prompt = promptFor(about);
      expect(prompt).toContain(`What would you like to see about ${aboutLabel(about)}? Tap one, or write your question.`);
      for (const choice of choicesFor(about)) expect(prompt).toContain(`[[${choice}]]`);
      expect(prompt).toMatch(/never write the same reply twice/i);
      expect(prompt).not.toMatch(/backlog/i);
    }
  });

  it("reports a refused or missing read, in the subject's own noun", () => {
    expect(readsWordsFor(application)).toContain("this application");
    expect(readsWordsFor(permit)).toContain("this permit");
    expect(readsWordsFor(licence)).toContain("this licence");
    expect(readsWordsFor(fee)).toContain("this fee");
    expect(readsWordsFor(service)).toContain("this service");
    for (const about of all) expect(readsWordsFor(about)).toMatch(/could not read/i);
  });
});

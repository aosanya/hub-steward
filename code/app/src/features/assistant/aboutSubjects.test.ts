import type { ChatAbout } from "../../app/chatAbout";
import { aboutLabel, choicesFor, emptyWordsFor, placeholderFor, promptFor, readNamesFor, readsWordsFor, scopeKeysFor, scopedArgs, stepWordsFor } from "./aboutSubjects";
import { residentChoices, residentPrompt, residentReadNames, residentReadsWords } from "./residentReads";

const resident: ChatAbout = { kind: "resident", id: "r1", name: "Takács Erzsébet" };
const group: ChatAbout = { kind: "group", id: "g1", name: "Szabó háztartás, Óváros" };
const registration: ChatAbout = { kind: "registration", id: "p2", name: "Kiss Ágnes", extra: { group: "Zöldhalom", asked: "Monday, 16 Nov", request: "jr9" } };
const conversation: ChatAbout = { kind: "conversation", id: "g2", name: "Hirdetőtábla", extra: { thread: "t9" } };
const business: ChatAbout = { kind: "business", id: "row7", name: "Szabó Pékség", extra: { owner: "o1", details: "Kind of business: Bakery. Neighbourhood: Óváros" } };
const staff: ChatAbout = { kind: "staff", id: "a1", name: "Anna Sample" };
const role: ChatAbout = { kind: "role", id: "k1", name: "Clerk", extra: { draft: "d4" } };
const trader: ChatAbout = { kind: "trader", id: "row8", name: "Katalin néni a piacon", extra: { owner: "o2", details: "What is sold: Honey and jam" } };

describe("the line that says what the chat is about", () => {
  it("names each subject in its own words", () => {
    expect(aboutLabel(resident)).toBe("Takács Erzsébet");
    expect(aboutLabel(group)).toBe("Szabó háztartás, Óváros");
    expect(aboutLabel(registration)).toBe("the registration of Kiss Ágnes for Zöldhalom");
    expect(aboutLabel(conversation)).toBe("Hirdetőtábla");
    expect(aboutLabel(business)).toBe("Szabó Pékség");
    expect(aboutLabel(trader)).toBe("Katalin néni a piacon");
  });
});

describe("the resident chat is exactly what it was", () => {
  it("keeps the resident reads, prompt, words and choices", () => {
    expect(readNamesFor(resident)).toEqual(residentReadNames);
    expect(promptFor(resident)).toBe(residentPrompt(resident));
    expect(readsWordsFor(resident)).toBe(residentReadsWords);
    expect(choicesFor(resident)).toEqual(residentChoices);
    expect(placeholderFor(resident)).toBe("Ask about Takács Erzsébet");
    expect(emptyWordsFor(resident)).toBe("Ask about Takács Erzsébet: bills, holdings, applications and raised items.");
    expect(scopedArgs(resident, "accounting_bill_list", { status: "open" })).toEqual({ status: "open", actor_id: "r1" });
    expect(scopeKeysFor(resident, "accounting_bill_list")).toEqual(["actor_id"]);
  });

  it("offers no reads when nothing is carried", () => {
    expect(readNamesFor(null)).toEqual([]);
    expect(scopedArgs(null, "accounting_bill_list", { a: 1 })).toEqual({ a: 1 });
  });
});

describe("the reads each subject may make", () => {
  it("a group reads its details, population, threads and messages", () => {
    expect(readNamesFor(group)).toEqual(["actor_get_group", "actor_get_group_population", "comm_chat_thread_list", "comm_chat_message_list"]);
    expect(scopedArgs(group, "actor_get_group", {})).toEqual({ group_id: "g1" });
    expect(scopedArgs(group, "actor_get_group_population", {})).toEqual({ group_id: "g1" });
    expect(scopedArgs(group, "comm_chat_thread_list", {})).toEqual({ structure_id: "g1" });
    expect(scopedArgs(group, "comm_chat_message_list", { thread_id: "t1" })).toEqual({ thread_id: "t1", structure_id: "g1" });
  });

  it("a registration reads the person's four resident reads, scoped to the person, and its own join request", () => {
    expect(readNamesFor(registration)).toEqual([...residentReadNames, "actor_get_join_request"]);
    expect(scopedArgs(registration, "accounting_bill_list", {})).toEqual({ actor_id: "p2" });
    expect(scopedArgs(registration, "digitaltwin_tenure_list", {})).toEqual({ holder_actor_id: "p2" });
    expect(scopedArgs(registration, "actor_get_join_request", {})).toEqual({ request_id: "jr9" });
    expect(scopeKeysFor(registration, "actor_get_join_request")).toEqual(["request_id"]);
  });

  it("the registration prompt reads the request with actor_get_join_request", () => {
    expect(promptFor(registration)).toContain("actor_get_join_request");
    expect(promptFor(registration)).not.toContain("is already known to you");
  });

  it("a conversation reads its messages in its own thread", () => {
    expect(readNamesFor(conversation)).toEqual(["comm_chat_message_list"]);
    expect(scopedArgs(conversation, "comm_chat_message_list", {})).toEqual({ structure_id: "g2", thread_id: "t9" });
  });

  it("a business or trader reads its applications, holdings and activity by its own row", () => {
    expect(readNamesFor(business)).toEqual(["forms_submission_list_of_person", "digitaltwin_tenure_list", "audit_list_entries"]);
    expect(scopedArgs(business, "forms_submission_list_of_person", {})).toEqual({ member_id: "o1", record_row_id: "row7" });
    expect(scopedArgs(business, "digitaltwin_tenure_list", {})).toEqual({ holder_record_row_id: "row7" });
    expect(scopedArgs(business, "audit_list_entries", {})).toEqual({ subject: "row7" });
    expect(readNamesFor(trader)).toEqual(readNamesFor(business));
    expect(scopedArgs(trader, "digitaltwin_tenure_list", {})).toEqual({ holder_record_row_id: "row8" });
  });

  it("hides the scoped arguments from the model", () => {
    expect(scopeKeysFor(group, "comm_chat_message_list")).toEqual(["structure_id"]);
    expect(scopeKeysFor(conversation, "comm_chat_message_list")).toEqual(["structure_id", "thread_id"]);
    expect(scopeKeysFor(business, "forms_submission_list_of_person")).toEqual(["member_id", "record_row_id"]);
  });

  it("gives every read a step word", () => {
    for (const about of [group, registration, conversation, business, trader]) {
      for (const name of readNamesFor(about)) expect(stepWordsFor(about)[name]).toBeTruthy();
    }
  });
});

describe("the words and choices follow the subject", () => {
  it("offers the group's Details, Members and Conversation", () => {
    expect(choicesFor(group)).toEqual(["Details", "Members", "Conversation"]);
    expect(choicesFor(registration)).toEqual(["Request", "Bills", "Holdings", "Applications", "Wishes and issues"]);
    expect(choicesFor(conversation)).toEqual(["Latest messages"]);
    expect(choicesFor(business)).toEqual(["Details", "Licences and permits", "Holdings", "Activity"]);
    expect(choicesFor(trader)).toEqual(choicesFor(business));
  });

  it("asks to tap one or write a question, in each prompt, with that subject's choices and no backlog texts", () => {
    for (const about of [group, registration, conversation, business, trader]) {
      const prompt = promptFor(about);
      expect(prompt).toContain(`What would you like to see about ${aboutLabel(about)}? Tap one, or write your question.`);
      for (const choice of choicesFor(about)) expect(prompt).toContain(`[[${choice}]]`);
      expect(prompt).toMatch(/never write the same reply twice/i);
      expect(prompt).not.toMatch(/backlog/i);
    }
  });

  it("a general question gets an overview built from the reads for each subject", () => {
    for (const about of [group, registration, business]) expect(promptFor(about)).toMatch(/tell me about|what do you know|summary/i);
  });

  it("the registration prompt carries the request, the business prompt carries its details", () => {
    expect(promptFor(registration)).toContain("Zöldhalom");
    expect(promptFor(registration)).toContain("Monday, 16 Nov");
    expect(promptFor(business)).toContain("Kind of business: Bakery");
    expect(promptFor(trader)).toContain("What is sold: Honey and jam");
  });

  it("names the subject in the placeholder and the empty state", () => {
    expect(placeholderFor(group)).toBe("Ask about Szabó háztartás, Óváros");
    expect(placeholderFor(registration)).toBe("Ask about Kiss Ágnes");
    expect(emptyWordsFor(group)).toBe("Ask about Szabó háztartás, Óváros: its details, members and conversation.");
    expect(emptyWordsFor(business)).toBe("Ask about Szabó Pékség: its details, licences and permits, holdings and activity.");
    expect(emptyWordsFor(conversation)).toBe("Ask about Hirdetőtábla: its latest messages.");
    expect(emptyWordsFor(registration)).toBe("Ask about Kiss Ágnes: the request, bills, holdings, applications and raised items.");
  });

  it("says a refused or missing read is reported for that read", () => {
    for (const about of [group, registration, conversation, business, trader]) expect(readsWordsFor(about)).toMatch(/cannot read|could not read/i);
  });
});

describe("a staff member and a role are subjects of their own", () => {
  it("names each by its own name", () => {
    expect(aboutLabel(staff)).toBe("Anna Sample");
    expect(aboutLabel(role)).toBe("Clerk");
  });

  it("a staff member reads their seats, standing, details and groups, scoped to them, and never the resident reads", () => {
    expect(readNamesFor(staff)).toEqual(["actor_list_role_assignments_for_actor", "actor_get_actor_standing", "actor_get_actor", "actor_list_groups_for_actor"]);
    for (const tool of readNamesFor(staff)) {
      expect(scopedArgs(staff, tool, {})).toEqual({ actor_id: "a1" });
      expect(scopeKeysFor(staff, tool)).toEqual(["actor_id"]);
    }
    for (const tool of ["accounting_bill_list", "digitaltwin_tenure_list", "forms_submission_list_of_person", "forms_catalog_raised_item_list_of_person"]) {
      expect(readNamesFor(staff)).not.toContain(tool);
    }
    expect(scopedArgs(staff, "actor_get_actor", { actor_id: "someone-else" })).toEqual({ actor_id: "a1" });
  });

  it("a role reads its holders, its permissions and the permission vocabulary, scoped to the role", () => {
    expect(readNamesFor(role)).toEqual(["actor_list_role_holders", "agency_list_roles", "agency_list_permissions"]);
    expect(scopedArgs(role, "actor_list_role_holders", {})).toEqual({ kind_id: "k1" });
    expect(scopedArgs(role, "agency_list_roles", {})).toEqual({ draft_id: "d4" });
    expect(scopedArgs(role, "agency_list_permissions", { a: 1 })).toEqual({ a: 1 });
    expect(scopeKeysFor(role, "actor_list_role_holders")).toEqual(["kind_id"]);
    expect(scopeKeysFor(role, "agency_list_permissions")).toEqual([]);
  });

  it("gives every read a step word", () => {
    for (const about of [staff, role]) for (const name of readNamesFor(about)) expect(stepWordsFor(about)[name]).toBeTruthy();
  });

  it("offers Seats, Details and Groups for a staff member and Holders, Approval limits and Permissions for a role", () => {
    expect(choicesFor(staff)).toEqual(["Seats", "Details", "Groups"]);
    expect(choicesFor(role)).toEqual(["Holders", "Approval limits", "Permissions"]);
  });

  it("asks to tap one or write a question, with the choices, the staff and role names, and no backlog texts", () => {
    for (const about of [staff, role]) {
      const prompt = promptFor(about);
      expect(prompt).toContain(`What would you like to see about ${aboutLabel(about)}? Tap one, or write your question.`);
      for (const choice of choicesFor(about)) expect(prompt).toContain(`[[${choice}]]`);
      expect(prompt).toMatch(/never write the same reply twice/i);
      expect(prompt).toMatch(/tell me about|what do you know|summary/i);
      expect(prompt).not.toMatch(/backlog/i);
    }
    expect(promptFor(staff)).toContain("actor_list_role_assignments_for_actor");
    expect(promptFor(role)).toContain("actor_list_role_holders");
  });

  it("names the subject in the placeholder and the empty state", () => {
    expect(placeholderFor(staff)).toBe("Ask about Anna Sample");
    expect(emptyWordsFor(staff)).toBe("Ask about Anna Sample: their seats, details and groups.");
    expect(emptyWordsFor(role)).toBe("Ask about Clerk: its holders, approval limits and permissions.");
  });

  it("reports a refused or missing read, in the subject's own noun", () => {
    expect(readsWordsFor(staff)).toMatch(/cannot read|could not read/i);
    expect(readsWordsFor(staff)).toContain("this staff member");
    expect(readsWordsFor(role)).toContain("this role");
  });
});

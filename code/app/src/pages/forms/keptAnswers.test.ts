import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { forgetOpenAgency, openAgency } from "../../agency/open";
import { clearDraft, draftCount, formDraftKey, loadDraft, saveDraft } from "./answers";

beforeEach(() => {
  window.localStorage.clear();
  openAgency("farmers");
});

afterEach(() => {
  forgetOpenAgency();
  window.localStorage.clear();
});

describe("answers to a Forms screen form are kept by agency and form", () => {
  it("comes back for the same agency and form and not for another agency", () => {
    saveDraft(formDraftKey("borehole"), { q1: { text: "12", options: [] } });
    expect(loadDraft(formDraftKey("borehole"))).toEqual({ q1: { text: "12", options: [] } });
    openAgency("clinic");
    expect(loadDraft(formDraftKey("borehole"))).toEqual({});
    expect(draftCount(formDraftKey("borehole"))).toBe(0);
  });

  it("is gone after it is cleared", () => {
    saveDraft(formDraftKey("borehole"), { q1: { text: "12", options: [] } });
    clearDraft(formDraftKey("borehole"));
    expect(window.localStorage.getItem(formDraftKey("borehole"))).toBeNull();
  });

  it("reads a damaged store as an empty draft", () => {
    window.localStorage.setItem(formDraftKey("borehole"), "null");
    expect(loadDraft(formDraftKey("borehole"))).toEqual({});
  });
});

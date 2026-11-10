import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { autosaveDelayMs, useAutosave, useSaveWhenIdle } from "./useAutosave";
import { defaultLanguageChoices, languageChoices, languageName } from "./generalLanguages";
import { goalsHref, useArrivedNote, withCode } from "./goalsLinks";
import { noNote, useOutcomeNote } from "./profileOutcome";
import { groupLine, listOf, roleLine, textOf, userLine } from "./usersRead";
import { offeredTools } from "./toolSchemas";

const words = { en: { waitingForApproval: "Waiting for approval", submitFailed: "That did not go through" } };

const inI18n = ({ children }: { children: ReactNode }) => <I18nProvider initial={words}>{children}</I18nProvider>;

const arrivedWith = (state: unknown) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider initial={words}>
        <MemoryRouter initialEntries={[{ pathname: "/", state }]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          {children}
        </MemoryRouter>
      </I18nProvider>
    );
  };

describe("language names", () => {
  it("writes a language in its own tongue with a capital", () => {
    expect(languageName("de")).toBe("Deutsch");
    expect(languageName("en")).toBe("English");
  });

  it("falls back to the code it was given when the code is not a language", () => {
    expect(languageName("not a code")).toBe("not a code");
  });

  it("offers a value and a label for each code", () => {
    expect(languageChoices(["sw", "fr"])).toEqual([
      { value: "sw", label: languageName("sw") },
      { value: "fr", label: languageName("fr") },
    ]);
  });

  it("offers the app's languages first, leaves out the hub codes it already has and adds the rest", () => {
    const codes = defaultLanguageChoices(["en", "pt", "pt"]).map((choice) => choice.value);
    expect(codes.slice(0, 7)).toEqual(["en", "de", "sw", "es", "fr", "zh", "hu"]);
    expect(codes.filter((code) => code === "en")).toHaveLength(1);
    expect(codes.slice(7)).toEqual(["pt", "pt"]);
  });
});

describe("goalsHref", () => {
  it("is the goals page of the hub when it points nowhere in particular", () => {
    expect(goalsHref("h1")).toBe("/h/h1/goals");
  });

  it("carries the goal, the objective and what to add as the query", () => {
    expect(goalsHref("h1", { goal: "g1", objective: "o 2", add: "objective" })).toBe("/h/h1/goals?goal=g1&objective=o+2&add=objective");
  });

  it("encodes a hub id that needs it and leaves out what is not given", () => {
    expect(goalsHref("a/b", { goal: "g" })).toBe("/h/a%2Fb/goals?goal=g");
  });
});

describe("withCode", () => {
  it("puts the code into the template", () => {
    expect(withCode("Invite {code}", "abc", "Invite")).toBe("Invite abc");
  });

  it("uses the fallback when there is no code", () => {
    expect(withCode("Invite {code}", "", "Invite")).toBe("Invite");
  });
});

describe("useArrivedNote", () => {
  it("says the change waits for approval when the page was reached with an accepted outcome", () => {
    const { result } = renderHook(() => useArrivedNote(), { wrapper: arrivedWith({ outcome: "accepted" }) });
    expect(result.current).toEqual({ text: "Waiting for approval", failed: false });
  });

  it.each([[null], [{ outcome: "done" }], [{}]])("says nothing for %j", (state) => {
    const { result } = renderHook(() => useArrivedNote(), { wrapper: arrivedWith(state) });
    expect(result.current).toBe(noNote);
  });
});

describe("useOutcomeNote", () => {
  it("starts with no note", () => {
    const { result } = renderHook(() => useOutcomeNote(() => {}), { wrapper: inI18n });
    expect(result.current.note).toBe(noNote);
  });

  it("tells that an accepted change waits for approval and does not finish", () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useOutcomeNote(onDone), { wrapper: inI18n });
    act(() => result.current.report("accepted"));
    expect(result.current.note).toEqual({ text: "Waiting for approval", failed: false });
    expect(onDone).not.toHaveBeenCalled();
  });

  it("tells a failure as failed", () => {
    const { result } = renderHook(() => useOutcomeNote(() => {}), { wrapper: inI18n });
    act(() => result.current.report("failed"));
    expect(result.current.note).toEqual({ text: "That did not go through", failed: true });
  });

  it("clears the note and finishes when the change is done", () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useOutcomeNote(onDone), { wrapper: inI18n });
    act(() => result.current.report("failed"));
    act(() => result.current.report("done"));
    expect(result.current.note).toBe(noNote);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("clears the note on request", () => {
    const { result } = renderHook(() => useOutcomeNote(() => {}), { wrapper: inI18n });
    act(() => result.current.report("failed"));
    act(() => result.current.clear());
    expect(result.current.note).toBe(noNote);
  });
});

describe("useAutosave", () => {
  beforeEach(() => localStorage.clear());

  it("is off until it is chosen", () => {
    const { result } = renderHook(() => useAutosave());
    expect(result.current[0]).toBe(false);
  });

  it("remembers the choice for the next visit", () => {
    const { result } = renderHook(() => useAutosave());
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    expect(renderHook(() => useAutosave()).result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(renderHook(() => useAutosave()).result.current[0]).toBe(false);
  });

  it("still switches when the browser cannot store it", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    const { result } = renderHook(() => useAutosave());
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    vi.restoreAllMocks();
  });

  it("reads off when the browser cannot read the store", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(renderHook(() => useAutosave()).result.current[0]).toBe(false);
    vi.restoreAllMocks();
  });
});

describe("useSaveWhenIdle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves once the edit has sat for the delay", () => {
    const save = vi.fn();
    renderHook(() => useSaveWhenIdle(true, save, "a"));
    vi.advanceTimersByTime(autosaveDelayMs - 1);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("starts the wait again when the edit changes", () => {
    const save = vi.fn();
    const { rerender } = renderHook(({ edit }) => useSaveWhenIdle(true, save, edit), { initialProps: { edit: "a" } });
    vi.advanceTimersByTime(autosaveDelayMs - 100);
    rerender({ edit: "ab" });
    vi.advanceTimersByTime(autosaveDelayMs - 100);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("does not save when nothing is due or when it is no longer due", () => {
    const save = vi.fn();
    const { rerender } = renderHook(({ due }) => useSaveWhenIdle(due, save, "a"), { initialProps: { due: false } });
    vi.advanceTimersByTime(autosaveDelayMs * 2);
    expect(save).not.toHaveBeenCalled();
    rerender({ due: true });
    rerender({ due: false });
    vi.advanceTimersByTime(autosaveDelayMs * 2);
    expect(save).not.toHaveBeenCalled();
  });

  it("saves with the latest save function", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ save }) => useSaveWhenIdle(true, save, "a"), { initialProps: { save: first } });
    rerender({ save: second });
    vi.advanceTimersByTime(autosaveDelayMs);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("reading rows", () => {
  it("reads any value as text and nothing as empty", () => {
    expect(textOf("a")).toBe("a");
    expect(textOf(7)).toBe("7");
    expect(textOf(null)).toBe("");
    expect(textOf(undefined)).toBe("");
  });

  it("keeps only the objects of a list and reads a non-list as empty", () => {
    expect(listOf([{ a: 1 }, null, "x", 3, { b: 2 }])).toEqual([{ a: 1 }, { b: 2 }]);
    expect(listOf("nope")).toEqual([]);
    expect(listOf(undefined)).toEqual([]);
  });

  it("reads a user with the member code for a name when there is none, and drops seats without a role", () => {
    const line = userLine({
      id: "u1",
      member_code: "M-7",
      groups: ["A", "B"],
      roles: [
        { group: "A", role: "Manager" },
        { group: "B", role: "" },
      ],
      joined: "2026-11-01",
    } as never);
    expect(line).toEqual({ id: "u1", code: "M-7", name: "M-7", groups: ["A", "B"], roles: [{ group: "A", role: "Manager" }], joined: "2026-11-01" });
  });

  it("prefers the user's name and reads missing groups as none", () => {
    const line = userLine({ id: "u1", member_code: "M-7", user: "Amani" } as never);
    expect(line.name).toBe("Amani");
    expect(line.groups).toEqual([]);
    expect(line.roles).toEqual([]);
  });

  it("reads a group and counts its members as a number, zero when it is not one", () => {
    expect(groupLine({ id: "g", group: "Team", members: "12", mode: "open", ai_role: "Helper" } as never)).toEqual({ id: "g", name: "Team", members: 12, mode: "open", aiRole: "Helper" });
    expect(groupLine({ id: "g", group: "Team", members: "many" } as never).members).toBe(0);
  });

  it("reads a role and marks an AI role", () => {
    expect(roleLine({ id: "r", name: "Helper", description: "d", kind: "ai" })).toEqual({ id: "r", name: "Helper", description: "d", ai: true });
    expect(roleLine({ id: "r", name: "Manager", kind: "human" }).ai).toBe(false);
  });
});

describe("offeredTools", () => {
  it("names each tool once and always asks for the instance", () => {
    const names = offeredTools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const tool of offeredTools) {
      const schema = tool.inputSchema as { required: string[]; properties: Record<string, unknown>; additionalProperties: boolean };
      expect(schema.required[0]).toBe("instance_id");
      expect(schema.properties).toHaveProperty("instance_id");
      expect(schema.additionalProperties).toBe(false);
      for (const key of schema.required) expect(schema.properties).toHaveProperty(key);
    }
  });
});

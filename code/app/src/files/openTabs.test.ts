import { describe, expect, it } from "vitest";
import { focusTab, noTabs, openTab, showNoTab, withoutTab, type Tab } from "./openTabs";

const file = (name: string): Tab => ({ path: name, name, folder: false });

const names = (tabs: { open: Tab[] }) => tabs.open.map((tab) => tab.name);

const opened = (...list: string[]) => list.reduce((tabs, name) => openTab(tabs, file(name)), noTabs);

describe("the open tabs", () => {
  it("opens a tab at the right end and makes it active", () => {
    const tabs = opened("a", "b");
    expect(names(tabs)).toEqual(["a", "b"]);
    expect(tabs.active).toBe("b");
  });

  it("focuses a tab that is already open instead of opening a second one", () => {
    const tabs = openTab(opened("a", "b", "c"), file("a"));
    expect(names(tabs)).toEqual(["a", "b", "c"]);
    expect(tabs.active).toBe("a");
  });

  it("makes the right neighbour active when the active tab is closed", () => {
    expect(withoutTab(focusTab(opened("a", "b", "c"), "b"), "b").active).toBe("c");
  });

  it("makes the left neighbour active when the last tab is closed", () => {
    expect(withoutTab(opened("a", "b"), "b").active).toBe("a");
  });

  it("leaves the active tab alone when another tab is closed", () => {
    expect(withoutTab(opened("a", "b", "c"), "a").active).toBe("c");
  });

  it("has no active tab when the only tab is closed", () => {
    const tabs = withoutTab(opened("a"), "a");
    expect(tabs.open).toEqual([]);
    expect(tabs.active).toBeNull();
  });

  it("shows no tab without closing any", () => {
    const tabs = showNoTab(opened("a", "b"));
    expect(names(tabs)).toEqual(["a", "b"]);
    expect(tabs.active).toBeNull();
  });

  it("keeps every tab open however many are opened, the new one active", () => {
    const twelve = Array.from({ length: 12 }, (_, index) => `f${index + 1}`);
    const tabs = opened(...twelve);
    expect(names(tabs)).toEqual(twelve);
    expect(tabs.active).toBe("f12");
  });

  it("keeps every tab open when an old one is focused and another is opened", () => {
    const ten = Array.from({ length: 10 }, (_, index) => `f${index + 1}`);
    const tabs = openTab(focusTab(opened(...ten), "f1"), file("f11"));
    expect(names(tabs)).toEqual([...ten, "f11"]);
    expect(tabs.active).toBe("f11");
  });
});

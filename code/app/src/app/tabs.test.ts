import { describe, expect, it } from "vitest";
import { chatTab, homeTab, mainBar, myWorkTab, notificationsTab, ongoingTab, sideOf, sideTab, startTab, tabChosenIn, tabs } from "./tabs";

describe("the tabs of the main bar", () => {
  it("are Home, My work, Chat and Notifications, in that order", () => {
    expect(mainBar).toEqual([homeTab, myWorkTab, chatTab, notificationsTab]);
    expect(mainBar.map((tab) => tab.label)).toEqual(["Home", "My work", "Chat", "Notifications"]);
  });

  it("give My work the play icon and its own page, with Start and Ongoing kept as pages of their own", () => {
    expect(myWorkTab).toMatchObject({ id: "my-work", path: "/my-work", segment: "my-work", icon: "play" });
    expect(tabs).toEqual(expect.arrayContaining([myWorkTab, startTab, ongoingTab]));
    expect(mainBar).not.toContain(startTab);
    expect(mainBar).not.toContain(ongoingTab);
  });

  it("choose My work on To do, Ongoing and Start, in one agency or none", () => {
    ["/a/alego/my-work", "/a/alego/ongoing", "/a/alego/do-something", "/my-work", "/ongoing", "/do-something"].forEach((path) => {
      expect(tabChosenIn(myWorkTab, path, path.startsWith("/a/") ? "alego" : "")).toBe(true);
      expect(tabChosenIn(homeTab, path, path.startsWith("/a/") ? "alego" : "")).toBe(false);
    });
  });

  it("choose no tab on a screen that belongs to none", () => {
    expect(mainBar.some((tab) => tabChosenIn(tab, "/a/alego/steps/s1", "alego"))).toBe(false);
  });

  it("know three sides of My work", () => {
    expect(sideOf("/a/alego/my-work")).toBe("todo");
    expect(sideOf("/a/alego/do-something")).toBe("start");
    expect(sideOf("/a/alego/ongoing")).toBe("ongoing");
    expect([sideTab("todo"), sideTab("start"), sideTab("ongoing")]).toEqual([myWorkTab, startTab, ongoingTab]);
  });
});

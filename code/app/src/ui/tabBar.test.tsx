import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { InboxClient } from "../inbox/api";
import { rememberSide, sideReached } from "../tabs";
import { doSomethingBackPath } from "../routes";
import { TabBar } from "./TabBar";

const quietInbox = { listNotifications: () => Promise.resolve([]) } as unknown as InboxClient;

const open = (path = "/a/walk-siaya/home") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <TabBar inbox={quietInbox} />
    </MemoryRouter>,
  );

const labels = () => screen.getAllByRole("link").map((link) => link.textContent?.replace(/[^A-Za-z ]/g, ""));

afterEach(() => {
  forgetOpenAgency();
  rememberSide("start");
});

const iconsShown = () => screen.getAllByRole("link").map((link) => link.querySelector("svg")?.getAttribute("data-icon"));

describe("tab bar", () => {
  it("draws each tab with an icon, not a text glyph, the bell for Notifications", () => {
    open();
    expect(iconsShown()).toEqual(["home", "chat", "bell"]);
    screen.getAllByRole("link").forEach((link) => {
      expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      expect(link.querySelector(".pill")?.textContent).toBe("");
    });
  });

  it("shows Home, Chat and Notifications in that order", () => {
    open();
    expect(labels()).toEqual(["Home", "Chat", "Notifications"]);
  });

  it("has no Do Something, Apps or Started tab", () => {
    open();
    expect(screen.queryByRole("link", { name: /Do Something|Apps|Started/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("points Home, Chat and Notifications at the open agency's own pages", () => {
    openAgency("walk-siaya");
    open();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/a/walk-siaya/home",
      "/a/walk-siaya/chat",
      "/a/walk-siaya/notifications",
    ]);
  });

  it("points Home, Chat and Notifications at their plain paths when no agency is open", () => {
    open("/");
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/", "/chat", "/notifications"]);
  });

  it.each([
    ["/a/walk-siaya/home", "Home"],
    ["/a/walk-siaya/chat", "Chat"],
    ["/a/walk-siaya/notifications", "Notifications"],
  ])("chooses the one tab of %s", (path, label) => {
    openAgency("walk-siaya");
    open(path);
    const chosen = screen.getAllByRole("link").filter((link) => link.hasAttribute("aria-current"));
    expect(chosen.map((link) => link.textContent?.replace(/[^A-Za-z ]/g, ""))).toEqual([label]);
  });

  it.each([
    "/a/walk-siaya/do-something",
    "/a/walk-siaya/ongoing",
    "/a/walk-siaya/backlogs",
    "/a/walk-siaya/backlogs/all",
    "/a/walk-siaya/steps/s1",
    "/a/walk-siaya/start/s1",
    "/a/walk-siaya/market",
    "/a/walk-siaya/market/urea",
    "/a/walk-siaya/forms/f1",
    "/a/walk-siaya/join",
    "/a/walk-siaya/risks",
    "/asks",
    "/orders/o1",
    "/coordinator/orders/o1/payments",
    "/sell/maize",
  ])("keeps the same bar on %s with none chosen", (path) => {
    openAgency("walk-siaya");
    open(path);
    expect(labels()).toEqual(["Home", "Chat", "Notifications"]);
    screen.getAllByRole("link").forEach((link) => expect(link).not.toHaveAttribute("aria-current"));
  });

  it("keeps the bar the same width of slots, with no slot reserved", () => {
    open("/a/walk-siaya/ongoing");
    expect(screen.getByRole("navigation", { name: "Main" })).not.toHaveClass("reserve");
  });

  it("puts the unread count on the Notifications button", async () => {
    const unread = {
      listNotifications: () => Promise.resolve([{ id: "n1", event: "new_form", subjectKind: "form", subjectId: "f1", names: {}, createdAt: "2026-10-28T10:40:00Z", read: false }]),
    } as unknown as InboxClient;
    render(
      <MemoryRouter initialEntries={["/a/walk-siaya/ongoing"]}>
        <TabBar inbox={unread} />
      </MemoryRouter>,
    );
    const badge = await screen.findByLabelText("1 unread notifications");
    expect(screen.getByRole("link", { name: /Notifications/ })).toContainElement(badge);
    expect(screen.getByRole("link", { name: /Home/ })).not.toContainElement(badge);
  });

  it("remembers the side a person reached, and Back goes there", () => {
    openAgency("walk-siaya");
    const view = open("/a/walk-siaya/ongoing");
    expect(sideReached()).toBe("ongoing");
    view.unmount();
    open("/a/walk-siaya/steps/s1");
    expect(sideReached()).toBe("ongoing");
    expect(doSomethingBackPath()).toBe("/a/walk-siaya/ongoing");
  });

  it("sends Back to Start when Start was reached last, or nothing was", () => {
    openAgency("walk-siaya");
    expect(doSomethingBackPath()).toBe("/a/walk-siaya/do-something");
    rememberSide("ongoing");
    rememberSide("start");
    expect(doSomethingBackPath()).toBe("/a/walk-siaya/do-something");
  });

  it("keeps the same bar on the old inbox path", () => {
    openAgency("walk-siaya");
    open("/a/walk-siaya/inbox");
    expect(labels()).toEqual(["Home", "Chat", "Notifications"]);
  });
});

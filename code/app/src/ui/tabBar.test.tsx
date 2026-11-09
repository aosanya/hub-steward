import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { AgencyClient } from "../agency/modules";
import type { InboxClient } from "../inbox/api";
import { rememberSide, sideReached } from "../tabs";
import { doSomethingBackPath } from "../routes";
import { forgetTaskModules, TabBar } from "./TabBar";

const quietInbox = { listNotifications: () => Promise.resolve([]) } as unknown as InboxClient;

const agencyWith = (...codes: string[]): AgencyClient => ({
  read: () => Promise.resolve({ name: "Siaya", modules: codes.map((code) => ({ code, name: code })) }),
});

const open = (path = "/a/walk-siaya/home", agency = agencyWith()) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <TabBar inbox={quietInbox} agency={agency} />
    </MemoryRouter>,
  );

const labels = () => screen.getAllByRole("link").map((link) => link.textContent?.replace(/[^A-Za-z ]/g, ""));

afterEach(() => {
  forgetOpenAgency();
  forgetTaskModules();
  rememberSide("start");
});

describe("tab bar", () => {
  it("shows Home, Chat, Do Something and Inbox in that order on the home screen", () => {
    open();
    expect(labels()).toEqual(["Home", "Chat", "Do Something", "Inbox"]);
  });

  it("keeps the home bar on Chat and the Inbox", () => {
    open("/a/walk-siaya/chat");
    expect(labels()).toEqual(["Home", "Chat", "Do Something", "Inbox"]);
  });

  it("points Home and Do Something at their retired paths when no agency is open", () => {
    open("/");
    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /Do Something/ })).toHaveAttribute("href", "/do-something");
  });

  it("has no Apps tab and no Started tab", () => {
    open();
    expect(screen.queryByRole("link", { name: /Apps|Started/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("points every tab at the open agency's own pages", () => {
    openAgency("walk-siaya");
    open();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/a/walk-siaya/home",
      "/a/walk-siaya/chat",
      "/a/walk-siaya/do-something",
      "/a/walk-siaya/inbox",
    ]);
  });

  it.each(["do-something", "ongoing", "backlogs", "backlogs/all"])("shows Home, Start and Ongoing on %s, and Backlogs once the task module is on", async (segment) => {
    openAgency("walk-siaya");
    open(`/a/walk-siaya/${segment}`, agencyWith("taskmanager"));
    expect(await screen.findByRole("link", { name: /Backlogs/ })).toBeInTheDocument();
    expect(labels()).toEqual(["Home", "Start", "Ongoing", "Backlogs"]);
  });

  it("leaves Backlogs out while the task module is off", async () => {
    openAgency("walk-siaya");
    open("/a/walk-siaya/ongoing", agencyWith("market"));
    expect(await screen.findByRole("link", { name: /Ongoing/ })).toBeInTheDocument();
    expect(labels()).toEqual(["Home", "Start", "Ongoing"]);
  });

  it("leaves Backlogs out when the modules could not be read", async () => {
    openAgency("walk-siaya");
    open("/a/walk-siaya/do-something", { read: () => Promise.reject(new Error("down")) });
    expect(await screen.findByRole("link", { name: /Start/ })).toBeInTheDocument();
    expect(labels()).toEqual(["Home", "Start", "Ongoing"]);
  });

  it("marks Start on the Do Something page and Backlogs on a backlog's board", async () => {
    openAgency("walk-siaya");
    open("/a/walk-siaya/backlogs/all", agencyWith("taskmanager"));
    expect(await screen.findByRole("link", { name: /Backlogs/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Start/ })).not.toHaveAttribute("aria-current");
  });

  it.each([
    "/a/walk-siaya/steps/s1",
    "/a/walk-siaya/start/s1",
    "/a/walk-siaya/market",
    "/a/walk-siaya/market/urea",
    "/a/walk-siaya/forms/f1",
    "/a/walk-siaya/join",
    "/asks",
    "/orders/o1",
    "/offers",
    "/prices",
    "/group-orders/g1",
    "/coordinator/orders/o1/payments",
    "/supply/apply",
    "/sell/maize",
    "/stock",
  ])("keeps the Do Something bar on %s, with Start chosen when Start was where the person came from", async (path) => {
    openAgency("walk-siaya");
    open(path);
    await screen.findByRole("link", { name: /Start/ });
    expect(labels()).toEqual(["Home", "Start", "Ongoing"]);
    expect(screen.getByRole("link", { name: /Start/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Ongoing/ })).not.toHaveAttribute("aria-current");
  });

  it("chooses Ongoing on a screen opened from Ongoing, and Back goes there", async () => {
    openAgency("walk-siaya");
    const view = open("/a/walk-siaya/ongoing");
    await screen.findByRole("link", { name: /Ongoing/ });
    expect(sideReached()).toBe("ongoing");
    view.unmount();
    open("/a/walk-siaya/steps/s1");
    expect(await screen.findByRole("link", { name: /Ongoing/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Start/ })).not.toHaveAttribute("aria-current");
    expect(doSomethingBackPath()).toBe("/a/walk-siaya/ongoing");
  });

  it("sends Back to Start when Start was reached last, or nothing was", () => {
    openAgency("walk-siaya");
    expect(doSomethingBackPath()).toBe("/a/walk-siaya/do-something");
    rememberSide("ongoing");
    rememberSide("start");
    expect(doSomethingBackPath()).toBe("/a/walk-siaya/do-something");
  });

  it("keeps the home bar on the chat, the inbox and the home screen", async () => {
    openAgency("walk-siaya");
    for (const path of ["/a/walk-siaya/home", "/a/walk-siaya/chat", "/a/walk-siaya/inbox", "/a/walk-siaya/risks"]) {
      const view = open(path);
      expect(labels()).toEqual(["Home", "Chat", "Do Something", "Inbox"]);
      view.unmount();
    }
  });

  it("reserves the Backlogs slot while the first read is out, so the other tabs stay where they are", async () => {
    openAgency("walk-siaya");
    let answer: (modules: string[]) => void = () => undefined;
    const slow: AgencyClient = {
      read: () => new Promise((resolve) => (answer = (codes) => resolve({ name: "Siaya", modules: codes.map((code) => ({ code, name: code })) }))),
    };
    open("/a/walk-siaya/ongoing", slow);
    expect(screen.getByRole("navigation", { name: "Main" })).toHaveClass("reserve");
    expect(labels()).toEqual(["Home", "Start", "Ongoing"]);
    await act(async () => answer(["taskmanager"]));
    expect(await screen.findByRole("link", { name: /Backlogs/ })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).not.toHaveClass("reserve");
  });

  it("shows Backlogs at once on the next screen, from what the first read found", async () => {
    openAgency("walk-siaya");
    const first = open("/a/walk-siaya/ongoing", agencyWith("taskmanager"));
    await screen.findByRole("link", { name: /Backlogs/ });
    first.unmount();
    open("/a/walk-siaya/steps/s1", { read: () => new Promise(() => undefined) });
    expect(labels()).toEqual(["Home", "Start", "Ongoing", "Backlogs"]);
    expect(screen.getByRole("navigation", { name: "Main" })).not.toHaveClass("reserve");
  });

  it("drops what it remembered when the read fails, and keeps three tabs", async () => {
    openAgency("walk-siaya");
    const first = open("/a/walk-siaya/ongoing", agencyWith("taskmanager"));
    await screen.findByRole("link", { name: /Backlogs/ });
    first.unmount();
    open("/a/walk-siaya/ongoing", { read: () => Promise.reject(new Error("down")) });
    await waitFor(() => expect(labels()).toEqual(["Home", "Start", "Ongoing"]));
    expect(screen.getByRole("navigation", { name: "Main" })).not.toHaveClass("reserve");
  });

  it("keeps three tabs when the modules came back unread", async () => {
    openAgency("walk-siaya");
    open("/a/walk-siaya/ongoing", { read: () => Promise.resolve({ name: "Siaya", modules: [], modulesUnread: true }) });
    await waitFor(() => expect(screen.getByRole("navigation", { name: "Main" })).not.toHaveClass("reserve"));
    expect(labels()).toEqual(["Home", "Start", "Ongoing"]);
  });
});

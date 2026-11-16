import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Shell } from "./Shell";

const inShell = (props: Partial<Parameters<typeof Shell>[0]> = {}) =>
  render(
    <MemoryRouter>
      <Shell title="Chat" {...props}>
        <p>body</p>
      </Shell>
    </MemoryRouter>,
  );

describe("Shell action slot", () => {
  it("puts the action inside the app bar", () => {
    inShell({ action: <button type="button">Join a group</button> });
    expect(screen.getByRole("banner")).toContainElement(screen.getByRole("button", { name: "Join a group" }));
  });
});

describe("Shell title", () => {
  it("puts the title in the bar, not in the body", () => {
    inShell({ action: <button type="button">Join a group</button> });
    const title = screen.getByRole("heading", { level: 1, name: "Chat" });
    expect(screen.getByRole("banner")).toContainElement(title);
    expect(screen.getByRole("main")).not.toContainElement(title);
  });

  it("draws a bar holding only the title on a tabless screen with neither a back link nor an action", () => {
    inShell({ tabless: true });
    const bar = screen.getByRole("banner");
    expect(bar).toContainElement(screen.getByRole("heading", { level: 1, name: "Chat" }));
    expect(within(bar).queryByRole("button")).toBeNull();
  });

  it("puts the title under the bar, not in it, when the screen has a back link", () => {
    inShell({ onBack: () => undefined });
    const title = screen.getByRole("heading", { level: 1, name: "Chat" });
    expect(screen.getByRole("banner")).not.toContainElement(title);
    expect(screen.getByRole("main")).toContainElement(title);
  });

  it("leaves the back link alone in the bar", () => {
    inShell({ onBack: () => undefined });
    const bar = screen.getByRole("banner");
    expect(bar).toContainElement(screen.getByRole("button", { name: "Back" }));
    expect(within(bar).queryByRole("heading")).toBeNull();
  });

  it("draws the title as the first thing in the body, before what the screen holds", () => {
    inShell({ onBack: () => undefined });
    const title = screen.getByRole("heading", { level: 1, name: "Chat" });
    expect(screen.getByRole("main").firstElementChild).toBe(title.parentElement);
    expect(title.compareDocumentPosition(screen.getByText("body")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the action in the bar of a screen with a back link", () => {
    inShell({ onBack: () => undefined, action: <button type="button">My orders</button> });
    expect(screen.getByRole("banner")).toContainElement(screen.getByRole("button", { name: "My orders" }));
  });
});

describe("Shell sub line", () => {
  it("draws the sub line once, under the title, on a screen with a back link", () => {
    inShell({ onBack: () => undefined, sub: "Create group order" });
    const sub = screen.getAllByText("Create group order");
    expect(sub).toHaveLength(1);
    expect(screen.getByRole("main")).toContainElement(sub[0]);
    const title = screen.getByRole("heading", { level: 1, name: "Chat" });
    expect(title.compareDocumentPosition(sub[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(title.parentElement).toBe(sub[0].parentElement);
  });

  it("draws no sub line on a screen with a back link and none", () => {
    inShell({ onBack: () => undefined });
    expect(screen.getByRole("main").querySelector(".sub")).toBeNull();
  });

  it("draws no head at all on a root screen without a sub line", () => {
    inShell();
    expect(screen.getByRole("main").querySelector(".head")).toBeNull();
  });

  it("draws a root screen's sub line under the bar while the title stays in the bar", () => {
    inShell({ sub: "Mwanachama Farmers" });
    const bar = screen.getByRole("banner");
    expect(bar).toContainElement(screen.getByRole("heading", { level: 1, name: "Chat" }));
    const sub = screen.getByText("Mwanachama Farmers");
    expect(bar).not.toContainElement(sub);
    expect(screen.getByRole("main")).toContainElement(sub);
    expect(screen.getByRole("main").querySelector("h1")).toBeNull();
  });
});

describe("Shell headings", () => {
  it("has one level 1 heading on a root screen", () => {
    inShell({ sub: "Mwanachama Farmers" });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("has one level 1 heading on a screen with a back link and a sub line", () => {
    inShell({ onBack: () => undefined, sub: "Create group order" });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("Shell menu button", () => {
  const menuButton = () => screen.queryByRole("button", { name: "Menu" });

  it("sits at the right end of the bar on a root screen with the tab bar", () => {
    inShell();
    expect(screen.getByRole("banner")).toContainElement(menuButton());
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("is a hamburger named Menu, not an Account button", () => {
    inShell();
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(menuButton()).toHaveAttribute("aria-controls");
    expect(menuButton()!.querySelectorAll("svg path")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Account" })).toBeNull();
  });

  it("keeps the title in the bar beside the menu button on a root screen", () => {
    inShell();
    const bar = screen.getByRole("banner");
    expect(bar).toContainElement(screen.getByRole("heading", { level: 1, name: "Chat" }));
    expect(bar).toContainElement(menuButton());
  });

  it("is absent on a tabless root screen with no back link and no action", () => {
    inShell({ tabless: true });
    expect(menuButton()).toBeNull();
  });

  it("is present when the screen has a back link, at the right end of the bar after the back link", () => {
    inShell({ onBack: () => undefined });
    const bar = screen.getByRole("banner");
    expect(bar).toContainElement(menuButton());
    expect(bar).toContainElement(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Back" }).compareDocumentPosition(menuButton()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("sits after the action in the same group when the screen has one", () => {
    inShell({ action: <button type="button">Join a group</button> });
    const action = screen.getByRole("button", { name: "Join a group" });
    expect(menuButton()).not.toBeNull();
    expect(action.closest(".bar-action")).toBe(menuButton()!.closest(".bar-action"));
    expect(action.compareDocumentPosition(menuButton()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("is present on a tabless screen that has a back link, which still has no tab bar", () => {
    inShell({ tabless: true, onBack: () => undefined });
    expect(screen.getByRole("banner")).toContainElement(menuButton());
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
  });

  it("is present on a tabless screen that has an action, after the action", () => {
    inShell({ tabless: true, action: <button type="button">Join a group</button> });
    const action = screen.getByRole("button", { name: "Join a group" });
    expect(menuButton()).not.toBeNull();
    expect(action.closest(".bar-action")).toBe(menuButton()!.closest(".bar-action"));
  });
});

describe("Shell drawer", () => {
  const page = () => screen.getByRole("main").closest(".page") as HTMLElement;

  it("holds no account rows in the page while it is closed", () => {
    inShell();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByText("My profile")).toBeNull();
    expect(page().classList.contains("open")).toBe(false);
  });

  it("opens the five account rows and slides the bar, the body and the tab bar", async () => {
    inShell();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem")).toHaveLength(5);
    expect(page().classList.contains("open")).toBe(true);
    expect(page()).toContainElement(screen.getByRole("banner"));
    expect(page()).toContainElement(screen.getByRole("main"));
    expect(page()).toContainElement(screen.getByRole("navigation", { name: "Main" }));
    expect(page()).not.toContainElement(screen.getByRole("menu"));
  });

  it("keeps the action in the bar, beside the menu button, while it is open", async () => {
    inShell({ action: <button type="button">Join a group</button> });
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("banner")).toContainElement(screen.getByRole("button", { name: "Join a group" }));
  });

  it("closes from the menu button, from Escape and from a tap on the page", async () => {
    inShell();
    const button = screen.getByRole("button", { name: "Menu" });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(screen.queryByRole("menu")).toBeNull();
    await userEvent.click(button);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(button).toHaveFocus();
    await userEvent.click(button);
    await userEvent.click(screen.getByText("body"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("has no drawer to open on a tabless root screen with no button, and still draws the page in the frame", () => {
    inShell({ tabless: true });
    expect(page()).toContainElement(screen.getByRole("banner"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens from a screen with a back link and slides the page when it has no tab bar", async () => {
    inShell({ tabless: true, onBack: () => undefined });
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem")).toHaveLength(5);
    expect(page().classList.contains("open")).toBe(true);
    expect(page()).toContainElement(screen.getByRole("banner"));
    expect(page()).toContainElement(screen.getByRole("main"));
    expect(page()).not.toContainElement(screen.getByRole("menu"));
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
  });
});

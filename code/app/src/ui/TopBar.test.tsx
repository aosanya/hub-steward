import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { TopBar, type TopBarBack } from "./TopBar";

type Extras = { action?: ReactNode; menu?: boolean };

const bar = (extras: Extras = {}) =>
  render(
    <MemoryRouter>
      <TopBar title="Chat" {...extras} />
    </MemoryRouter>,
  );

const backedBar = (back: TopBarBack, extras: Extras = {}) =>
  render(
    <MemoryRouter>
      <TopBar back={back} {...extras} />
    </MemoryRouter>,
  );

describe("top bar", () => {
  it("is a banner holding the page's one level 1 title", () => {
    bar();
    expect(within(screen.getByRole("banner")).getByRole("heading", { level: 1, name: "Chat" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("holds nothing but the title when it has no back link, action or menu", () => {
    bar();
    expect(within(screen.getByRole("banner")).queryByRole("button")).toBeNull();
    expect(within(screen.getByRole("banner")).queryByRole("link")).toBeNull();
  });

  it("draws a back button that calls its handler", async () => {
    const onClick = vi.fn();
    backedBar({ onClick });
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("holds the back button alone, with no title, when it has a back link", () => {
    backedBar({ onClick: () => undefined });
    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(banner.children).toHaveLength(1);
  });

  it("holds the back link alone, with no title, when the link names its destination", () => {
    backedBar({ to: "/", label: "Do Something" });
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByRole("banner").children).toHaveLength(1);
  });

  it("keeps the action at the right of a back link", () => {
    backedBar({ onClick: () => undefined }, { action: <button type="button">My orders</button> });
    const back = screen.getByRole("button", { name: "Back" });
    const action = screen.getByRole("button", { name: "My orders" });
    expect(back.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("draws a back link named for its destination", () => {
    backedBar({ to: "/", label: "Do Something" });
    const back = screen.getByRole("link", { name: "Do Something" });
    expect(back).toHaveAttribute("href", "/");
    expect(back).toHaveTextContent("‹ Do Something");
  });

  it("puts the action and then the menu button at the right end after the title", () => {
    bar({ action: <button type="button">Join a group</button>, menu: true });
    const title = screen.getByRole("heading", { level: 1 });
    const action = screen.getByRole("button", { name: "Join a group" });
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(title.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(action.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(action.closest(".bar-action")).toBe(menu.closest(".bar-action"));
  });

  it("draws the menu button as three lines, closed, with no Account button", () => {
    bar({ menu: true });
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu.querySelectorAll("svg path")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Account" })).toBeNull();
  });

  it("keeps the menu button at the right of a back link", () => {
    backedBar({ to: "/", label: "Do Something" }, { menu: true });
    const back = screen.getByRole("link", { name: "Do Something" });
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(back.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("draws no menu button unless asked", () => {
    bar({ action: <button type="button">Join a group</button> });
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { NoticeCtx, PageHeader, type HeaderAction } from ".";
import { openActions } from "./pageHeader.test-support";

const words = { en: { actions: "Actions" } };

const show = (ui: ReactElement) =>
  render(
    <I18nProvider initial={words}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>
    </I18nProvider>,
  );

const save: HeaderAction = { label: "Save changes", icon: "check", primary: true, onClick: () => {} };
const open: HeaderAction = { label: "Open Status", icon: "arrow", to: "/h/x/status" };
const remove: HeaderAction = { label: "Remove", icon: "trash", danger: true, onClick: () => {} };

describe("PageHeader", () => {
  it("shows the title as the page heading in the top bar and no button when it has nothing to do", () => {
    const { container } = show(<PageHeader title="Models" />);
    expect(screen.getByRole("heading", { level: 1, name: "Models" })).toBeInTheDocument();
    expect(container.querySelector(".top > h1")).toHaveTextContent("Models");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector(".top-end")).toBeNull();
  });

  it("shows the status slot right after the title, a tag when it has a tone and plain text when it has none", () => {
    const { container } = show(<PageHeader title="Profile" meta={[{ text: "Staff seat", tone: "mute" }, { text: "Saved at 10:00" }]} />);
    const slot = container.querySelector(".top > h1 + .top-meta") as HTMLElement;
    expect(slot).not.toBeNull();
    expect(within(slot).getByText("Staff seat")).toHaveClass("tag", "mute");
    expect(within(slot).getByText("Saved at 10:00")).toHaveClass("muted");
  });

  it("draws the switches left of the one Actions button and keeps a switch when there is no action", async () => {
    const onChange = vi.fn();
    const { container } = show(<PageHeader title="Profile" switches={[{ label: "Autosave", on: true, onChange }]} actions={[save]} />);
    const end = container.querySelector(".top-end") as HTMLElement;
    expect([...end.children].map((child) => child.className)).toEqual(["toggle", "actions"]);
    await userEvent.click(screen.getByRole("switch", { name: "Autosave" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("keeps the switch and draws no Actions button when there is no action", () => {
    show(<PageHeader title="Profile" switches={[{ label: "Autosave", on: false, onChange: () => {} }]} />);
    expect(screen.getByRole("switch", { name: "Autosave" })).not.toBeChecked();
    expect(screen.queryByRole("button", { name: "Actions" })).not.toBeInTheDocument();
  });

  it("puts every action in one quiet Actions button, closed to begin with, and no loose button beside it", () => {
    show(<PageHeader title="Profile" actions={[save, open, remove]} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent("Actions");
    expect(buttons[0]).toHaveClass("btn", "quiet");
    expect(buttons[0]).toHaveAttribute("aria-haspopup", "menu");
    expect(buttons[0]).toHaveAttribute("aria-expanded", "false");
    expect(buttons[0].querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows the primary item first with the accent, the others in order and the danger item last behind a divider", async () => {
    const { container } = show(
      <PageHeader title="Profile" actions={[{ ...remove }, open, { label: "Enhance", icon: "wand", onClick: () => {} }, save]} />,
    );
    await openActions();
    expect(screen.getByRole("button", { name: "Actions" })).toHaveAttribute("aria-expanded", "true");
    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Save changes", "Open Status", "Enhance", "Remove"]);
    expect(items[0]).toHaveClass("actions-item", "primary");
    expect(items[3]).toHaveClass("actions-item", "danger");
    const menu = container.querySelector(".actions-menu") as HTMLElement;
    const kinds = [...menu.children].map((child) => (child.getAttribute("role") === "separator" ? "rule" : "item"));
    expect(kinds).toEqual(["item", "item", "item", "rule", "item"]);
  });

  it("draws no divider when no action is dangerous", async () => {
    show(<PageHeader title="Profile" actions={[save, open]} />);
    await openActions();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("shows an icon on every item", async () => {
    show(<PageHeader title="Profile" actions={[save, open, remove, { label: "Working", icon: "wand", busy: true }]} />);
    await openActions();
    for (const item of screen.getAllByRole("menuitem")) {
      expect(item.querySelector("svg, .tool-spin")).not.toBeNull();
    }
  });

  it("calls the action and closes the menu when an item is chosen", async () => {
    const onClick = vi.fn();
    show(<PageHeader title="Profile" actions={[{ ...save, onClick }]} />);
    await openActions();
    await userEvent.click(screen.getByRole("menuitem", { name: "Save changes" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("makes an item with a place to go a link", async () => {
    show(<PageHeader title="Profile" actions={[open]} />);
    await openActions();
    const link = screen.getByRole("menuitem", { name: "Open Status" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/h/x/status");
  });

  it("keeps a disabled item disabled and does not call it", async () => {
    const onClick = vi.fn();
    show(<PageHeader title="Publish" actions={[{ label: "Publish", icon: "send", primary: true, disabled: true, onClick }]} />);
    await openActions();
    const item = screen.getByRole("menuitem", { name: "Publish" });
    expect(item).toBeDisabled();
    await userEvent.click(item);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows a busy item with the spinner, dimmed and busy", async () => {
    show(<PageHeader title="Profile" actions={[{ label: "Enhance", icon: "wand", busy: true, onClick: () => {} }]} />);
    await openActions();
    const item = screen.getByRole("menuitem", { name: "Enhance" });
    expect(item).toBeDisabled();
    expect(item).toHaveAttribute("aria-busy", "true");
    expect(item.querySelector(".tool-spin")).not.toBeNull();
  });

  it("flashes the Actions button while the primary item asks for attention", () => {
    show(<PageHeader title="Profile" actions={[{ ...save, flash: true }]} />);
    expect(screen.getByRole("button", { name: "Actions" })).toHaveClass("flash");
  });

  it("does not flash the Actions button otherwise", () => {
    show(<PageHeader title="Profile" actions={[save]} />);
    expect(screen.getByRole("button", { name: "Actions" })).not.toHaveClass("flash");
  });

  it("closes the menu on Escape and gives the focus back to the Actions button", async () => {
    show(<PageHeader title="Profile" actions={[save, open]} />);
    await openActions();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions" })).toHaveFocus();
  });

  it("closes the menu on a click elsewhere", async () => {
    show(
      <>
        <PageHeader title="Profile" actions={[save]} />
        <p>Elsewhere</p>
      </>,
    );
    await openActions();
    await userEvent.click(screen.getByText("Elsewhere"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("moves through the items with the arrow keys, Home and End, skipping a disabled one", async () => {
    show(<PageHeader title="Profile" actions={[save, { ...open, to: undefined, disabled: true, onClick: () => {} }, remove]} />);
    await openActions();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Save changes" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Remove" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Save changes" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Remove" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("menuitem", { name: "Save changes" })).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Remove" })).toHaveFocus();
  });

  it("shows the held notice directly under the top bar", () => {
    const held = { message: { id: 1, text: "Added.", kind: "ok" as const }, show: () => {}, dismiss: () => {} };
    const { container } = show(
      <NoticeCtx.Provider value={held}>
        <PageHeader title="Models" />
      </NoticeCtx.Provider>,
    );
    expect(container.querySelector(".top + .notice")).toHaveTextContent("Added.");
  });
});

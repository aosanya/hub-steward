import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AccountMenu, accountItems } from "./AccountMenu";
import { DrawerFrame } from "./DrawerFrame";
import { TopBar } from "./TopBar";

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

const open = () =>
  render(
    <MemoryRouter initialEntries={["/start"]}>
      <DrawerFrame drawer={<AccountMenu />}>
        <TopBar title="Start" menu />
        <button type="button">elsewhere</button>
      </DrawerFrame>
      <Where />
    </MemoryRouter>,
  );

const menuButton = () => screen.getByRole("button", { name: "Menu" });
const titles = () => screen.getAllByRole("menuitem").map((item) => item.querySelector(".ttl")?.textContent);

describe("the account menu items", () => {
  it("are the five account pages, in this order", () => {
    expect(accountItems).toEqual([
      { title: "My profile", path: "/profile" },
      { title: "Switch agency", path: "/agencies" },
      { title: "Change language", path: "/language" },
      { title: "Consent", path: "/consent" },
      { title: "Sign out", path: "/sign-out" },
    ]);
  });
});

describe("the menu button", () => {
  it("is named Menu, not Account, and shows closed with no rows on the page", () => {
    open();
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Account" })).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  });

  it("shows three lines and no text taken from the member's id", () => {
    open();
    expect(menuButton().textContent).toBe("");
    expect(menuButton().querySelectorAll("svg path")).toHaveLength(3);
  });

  it("opens the five items in order", async () => {
    open();
    await userEvent.click(menuButton());
    expect(menuButton()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "Menu" })).toBeInTheDocument();
    expect(titles()).toEqual(["My profile", "Switch agency", "Change language", "Consent", "Sign out"]);
  });

  it("points at the drawer with aria-controls, open or closed", async () => {
    open();
    const id = menuButton().getAttribute("aria-controls");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)).not.toBeNull();
    await userEvent.click(menuButton());
    expect(document.getElementById(id!)).toContainElement(screen.getByRole("menu"));
  });

  it("puts focus on the first item when the drawer opens", async () => {
    open();
    await userEvent.click(menuButton());
    expect(screen.getByRole("menuitem", { name: /My profile/ })).toHaveFocus();
  });

  it("names each item by its title alone, leaving the chevron and the lead letter out of the name", async () => {
    open();
    await userEvent.click(menuButton());
    accountItems.forEach(({ title }) => expect(screen.getByRole("menuitem", { name: title })).toBeInTheDocument());
  });

  it("keeps the lead letter and the aria-hidden chevron on each row", async () => {
    open();
    await userEvent.click(menuButton());
    const rows = screen.getAllByRole("menuitem");
    expect(rows.map((row) => row.querySelector(".lead")?.textContent)).toEqual(["M", "S", "C", "C", "S"]);
    rows.forEach((row) => {
      expect(row.querySelector(".lead")).toHaveAttribute("aria-hidden", "true");
      expect(row.querySelector(".end")).toHaveAttribute("aria-hidden", "true");
      expect(row.querySelector(".end")).toHaveTextContent("›");
    });
  });

  it("closes when the button is pressed again", async () => {
    open();
    await userEvent.click(menuButton());
    await userEvent.click(menuButton());
    expect(screen.queryByRole("menu")).toBeNull();
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("choosing an account item", () => {
  it.each(accountItems)("goes to $path from $title and closes the drawer", async ({ title, path }) => {
    open();
    await userEvent.click(menuButton());
    await userEvent.click(screen.getByRole("menuitem", { name: title }));
    expect(screen.getByTestId("where")).toHaveTextContent(path);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("leaving the drawer without choosing", () => {
  it("closes on Escape, gives focus back to the button and goes nowhere", async () => {
    open();
    await userEvent.click(menuButton());
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(menuButton()).toHaveFocus();
    expect(screen.getByTestId("where")).toHaveTextContent("/start");
  });

  it("closes on a tap outside the drawer and goes nowhere", async () => {
    open();
    await userEvent.click(menuButton());
    await userEvent.click(screen.getByRole("button", { name: "elsewhere" }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByTestId("where")).toHaveTextContent("/start");
  });

  it("stays open on a tap on the drawer's own padding", async () => {
    open();
    await userEvent.click(menuButton());
    await userEvent.click(screen.getByRole("menu").parentElement!);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});

describe("moving through the drawer with the arrow keys", () => {
  it("steps down the items and wraps from the last to the first", async () => {
    open();
    await userEvent.click(menuButton());
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: /Switch agency/ })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: /Sign out/ })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: /My profile/ })).toHaveFocus();
  });

  it("steps up from the first item to the last", async () => {
    open();
    await userEvent.click(menuButton());
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: /Sign out/ })).toHaveFocus();
  });
});

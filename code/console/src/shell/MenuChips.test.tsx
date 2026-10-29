import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useMemo, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../i18n";
import { SessionProvider } from "../session";
import { ConsoleCtx, useMenuCount, type ConsoleContext } from "./context";
import { Menu } from "./Menu";
import { noBadges, type Badges } from "./page";

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const hub = { id: "siaya", name: "Siaya Community Computer Lab", role: "owner" };

function Reporter({ count }: { count: number | undefined }) {
  useMenuCount(count);
  return <h1>A page that reports</h1>;
}

function Host({ page, count }: { page: string; count: number | undefined }) {
  const [badges, setBadges] = useState<Badges>(noBadges);
  const [shown, setShown] = useState(true);
  const value = useMemo<ConsoleContext>(() => ({ hub, page, setBadges, refreshMenu: () => {} }), [page]);
  return (
    <ConsoleCtx.Provider value={value}>
      <Menu hubId={hub.id} kind="lab" page={page} badges={badges} />
      <button type="button" onClick={() => setShown(false)}>
        leave the page
      </button>
      {shown ? <Reporter count={count} /> : null}
    </ConsoleCtx.Provider>
  );
}

function open(page: string, count: number | undefined) {
  const view = (n: number | undefined) => (
    <MemoryRouter>
      <I18nProvider initial={words}>
        <SessionProvider>
          <Host page={page} count={n} />
        </SessionProvider>
      </I18nProvider>
    </MemoryRouter>
  );
  const { rerender } = render(view(count));
  return (n: number | undefined) => rerender(view(n));
}

const menu = () => screen.getByRole("navigation", { name: "Menu" });
const row = (name: RegExp) => within(menu()).getByRole("link", { name });

describe("the count a page reports for its menu item", () => {
  it("shows a chip beside the page's own item", () => {
    open("groups", 3);

    const chip = within(row(/^Groups/)).getByText("3");
    expect(chip).toHaveClass("nav-badge");
  });

  it("shows no chip when the page reports no count", () => {
    open("groups", undefined);

    expect(menu().querySelector(".nav-badge")).toBeNull();
  });

  it("shows no chip for a count of none", () => {
    open("groups", 0);

    expect(menu().querySelector(".nav-badge")).toBeNull();
  });

  it("follows the count as the page changes it", () => {
    const report = open("groups", 3);

    act(() => report(5));

    expect(within(row(/^Groups/)).getByText("5")).toHaveClass("nav-badge");
    expect(menu().querySelectorAll(".nav-badge")).toHaveLength(1);
  });

  it("takes the chip away when the page is left", async () => {
    open("groups", 3);

    await userEvent.setup().click(screen.getByRole("button", { name: "leave the page" }));

    expect(menu().querySelector(".nav-badge")).toBeNull();
  });
});

describe("the menu keeps the open page in sight", () => {
  it("scrolls the row of the open page into view, and no other row", () => {
    const scrolled: string[] = [];
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
      scrolled.push(this.textContent ?? "");
    };
    try {
      open("review-goals", undefined);
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
    expect(scrolled).toEqual(["Goals"]);
  });
});

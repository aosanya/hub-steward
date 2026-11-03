import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../i18n";
import { SessionProvider } from "../session";
import { Menu } from "./Menu";
import { noBadges } from "./page";

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

function open(page: string, role: string) {
  render(
    <MemoryRouter>
      <I18nProvider initial={words}>
        <SessionProvider>
          <Menu hubId="siaya" kind="lab" role={role} page={page} badges={noBadges} />
        </SessionProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
  return within(screen.getByRole("navigation", { name: "Menu" }));
}

describe("the Models rows of the menu", () => {
  it("indent Configure and Usage under Models, and the three Usage pages one step further", () => {
    const menu = open("usage-work", "owner");

    expect(menu.getByRole("link", { name: "Models" })).toHaveAttribute("aria-expanded", "true");
    expect(menu.getByRole("link", { name: "Configure" })).toHaveClass("sub");
    expect(menu.getByRole("link", { name: "Configure" })).not.toHaveClass("deep");
    expect(menu.getByRole("link", { name: /^Usage/ })).toHaveClass("sub");
    expect(menu.getByRole("link", { name: "Kind of work" })).toHaveClass("deep");
    expect(menu.getByRole("link", { name: "Kind of work" })).toHaveAttribute("aria-current", "page");
  });

  it("mark Configure on the Models page, and offer a staff seat Configure only", () => {
    const menu = open("models", "agent");

    expect(menu.getByRole("link", { name: "Configure" })).toHaveAttribute("aria-current", "page");
    expect(menu.queryByRole("link", { name: /^Usage/ })).toBeNull();
  });
});

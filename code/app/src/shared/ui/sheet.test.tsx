import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Sheet } from "./Sheet";
import { magyar } from "../language/magyar";
import { swahili } from "../language/swahili";
import { words } from "../language/words";

describe("Sheet", () => {
  it("shows its title as a dialog with its children", () => {
    render(
      <Sheet title="Rule on" onClose={() => undefined}>
        <p>Tag</p>
      </Sheet>,
    );
    expect(screen.getByRole("dialog", { name: "Rule on" })).toContainElement(screen.getByText("Tag"));
  });

  it("closes from the scrim and from Escape", async () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Rule on" onClose={onClose}>
        <p>Tag</p>
      </Sheet>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps its content at full height and scrolls instead of squeezing a row", () => {
    const css = readFileSync(join(__dirname, "sheet.css"), "utf8");
    expect(css).toMatch(/\.sheet > \*\s*\{[^}]*flex-shrink: 0/);
  });

  it("has the word for Close in every language", () => {
    expect(words.close).toBe("Close");
    expect(swahili.close).toBe("Funga");
    expect(magyar.close).toBe("Bezárás");
  });

  it("names its scrim in the chosen language", () => {
    window.localStorage.setItem("hub.language", "hu");
    render(
      <Sheet title="Rule on" onClose={() => undefined}>
        <p>Tag</p>
      </Sheet>,
    );
    expect(screen.getByRole("button", { name: "Bezárás" })).toBeInTheDocument();
    window.localStorage.removeItem("hub.language");
  });
});

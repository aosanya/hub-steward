import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveTheme, themes, useTheme } from "./theme";

function Probe() {
  const { theme, setTheme, themes: offered } = useTheme();
  return (
    <div>
      <p data-testid="theme">{theme}</p>
      <p data-testid="offered">{offered.map((t) => `${t.key}:${t.label}`).join(",")}</p>
      {offered.map((t) => (
        <button key={t.key} type="button" onClick={() => setTheme(t.key)}>
          {t.label}
        </button>
      ))}
      <button type="button" onClick={() => setTheme("neon")}>
        neon
      </button>
    </div>
  );
}

const shown = () => screen.getByTestId("theme").textContent;

beforeEach(() => {
  localStorage.clear();
  saveTheme("dark");
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  act(() => saveTheme("dark"));
});

describe("the theme of the console", () => {
  it("offers the five palettes of the design with the design's labels", () => {
    render(<Probe />);

    expect(screen.getByTestId("offered")).toHaveTextContent("dark:Dark,light:Light,midnight:Midnight,forest:Forest,contrast:High contrast");
    expect(themes.map((t) => t.colours.length)).toEqual([3, 3, 3, 3, 3]);
  });

  it("is dark when nothing is stored", () => {
    render(<Probe />);

    expect(shown()).toBe("dark");
  });

  it("reads the theme stored in the browser under the key theme", () => {
    localStorage.setItem("theme", "forest");
    render(<Probe />);

    expect(shown()).toBe("forest");
  });

  it("falls back to dark for a stored value that is not one of the five", () => {
    localStorage.setItem("theme", "neon");
    render(<Probe />);

    expect(shown()).toBe("dark");
  });

  it("switches at once, stores the choice and puts it on the root element of the page", async () => {
    const user = userEvent.setup();
    render(<Probe />);

    await user.click(screen.getByRole("button", { name: "High contrast" }));

    expect(shown()).toBe("contrast");
    expect(localStorage.getItem("theme")).toBe("contrast");
    expect(document.documentElement.dataset.theme).toBe("contrast");
  });

  it("ignores a theme the design does not have", async () => {
    const user = userEvent.setup();
    localStorage.setItem("theme", "light");
    render(<Probe />);

    await user.click(screen.getByRole("button", { name: "neon" }));

    expect(shown()).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("tells every part of the page that uses it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Probe />
        <Probe />
      </>,
    );

    await user.click(screen.getAllByRole("button", { name: "Midnight" })[0]);

    expect(screen.getAllByTestId("theme").map((node) => node.textContent)).toEqual(["midnight", "midnight"]);
  });

  it("follows a change made in another tab", () => {
    render(<Probe />);

    act(() => {
      localStorage.setItem("theme", "light");
      window.dispatchEvent(new StorageEvent("storage", { key: "theme", newValue: "light" }));
    });

    expect(shown()).toBe("light");
  });

  it("is dark when the browser refuses to read its storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<Probe />);

    expect(shown()).toBe("dark");
  });

  it("still switches for the visit when the browser refuses to write its storage", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<Probe />);

    await user.click(screen.getByRole("button", { name: "Light" }));

    expect(shown()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

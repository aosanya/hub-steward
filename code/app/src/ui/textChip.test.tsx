import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { hueOf, shadeOf } from "./textColor";
import { TextChip } from "./TextChip";

const look = (text: string, shown?: string) => {
  const { container } = render(<TextChip text={text}>{shown}</TextChip>);
  return container.querySelector<HTMLElement>(".chip")!;
};

describe("a bubble coloured from its text", () => {
  it("shows its text when given nothing else to show", () => {
    expect(look("Waiting").textContent).toBe("Waiting");
  });

  it("takes its colour from the text, not from what it shows, so To do 1301 and To do 12 match", () => {
    const a = look("To do", "To do 1301");
    const b = look("To do", "To do 12");
    expect(a.textContent).toBe("To do 1301");
    expect(a.style.getPropertyValue("--hue")).toBe(b.style.getPropertyValue("--hue"));
    expect(a.style.getPropertyValue("--hue")).toBe(String(hueOf("To do")));
    expect(a.style.getPropertyValue("--shade")).toBe(String(shadeOf("To do")));
  });

  it("colours the four step names apart from each other", () => {
    const hues = new Set(["To do", "Waiting", "Doing", "Done"].map(hueOf));
    expect(hues.size).toBeGreaterThanOrEqual(3);
  });

  it("never picks a red or a green hue", () => {
    const sample = ["To do", "Waiting", "Doing", "Done", "hub-steward-swe", "Backlog", "a", "zz", ...Array.from({ length: 2000 }, (_, at) => `text-${at}`)];
    for (const text of sample) {
      expect(hueOf(text)).toBeGreaterThanOrEqual(185);
      expect(hueOf(text)).toBeLessThanOrEqual(330);
    }
  });

  it("varies the shade in five steps", () => {
    const sample = Array.from({ length: 720 }, (_, at) => `text-${at}`);
    expect([...new Set(sample.map(shadeOf))].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("leaves Ready and Blocked the tones that carry their meaning", () => {
    expect(look("Ready")).toHaveClass("success");
    expect(look("Blocked")).toHaveClass("danger");
  });

  it("is pressable when given a handler", () => {
    const { container } = render(<TextChip text="Docs" onClick={() => undefined} pressed />);
    expect(container.querySelector("button")?.getAttribute("aria-pressed")).toBe("true");
  });
});

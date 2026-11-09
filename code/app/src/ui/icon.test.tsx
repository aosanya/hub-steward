import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon, iconNames, type IconName } from "./Icon";

const svgOf = (name: IconName) => render(<Icon name={name} />).container.querySelector("svg")!;

describe("the shared icon", () => {
  it("draws a 24 by 24 line icon in the colour of the text, hidden from screen readers", () => {
    const svg = svgOf("home");

    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("stroke-width", "1.5");
    expect(svg).toHaveAttribute("stroke-linecap", "round");
    expect(svg).toHaveAttribute("stroke-linejoin", "round");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("data-icon", "home");
  });

  it("has a drawing for each name of the tab bar", () => {
    expect(iconNames).toEqual(["home", "chat", "grid", "play", "clock", "list"]);
    iconNames.forEach((name) => expect(svgOf(name).childElementCount).toBeGreaterThan(0));
  });

  it("sets no pixel size, so the style sheet sizes it in rem", () => {
    const svg = svgOf("chat");

    expect(svg).not.toHaveAttribute("width");
    expect(svg).not.toHaveAttribute("height");
    expect(svg).toHaveClass("icon");
  });
});

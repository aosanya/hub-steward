import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon } from "./Icon";

const svgOf = (name: string, props: object = {}) => render(<Icon name={name} {...props} />).container.querySelector("svg");

describe("the icons of the design", () => {
  it("draws a 24 by 24 outline icon in the colour of the text, sixteen pixels wide, hidden from screen readers", () => {
    const svg = svgOf("pulse")!;

    expect(svg).toHaveAttribute("width", "16");
    expect(svg).toHaveAttribute("height", "16");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("stroke-width", "2");
    expect(svg).toHaveAttribute("stroke-linecap", "round");
    expect(svg).toHaveAttribute("stroke-linejoin", "round");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg?.querySelector("path")).toHaveAttribute("d", "M22 12h-4l-3 9L9 3l-3 9H2");
  });

  it("takes a size, a stroke width and a class", () => {
    const svg = svgOf("check", { size: 18, stroke: 2.4, className: "tick" })!;

    expect(svg).toHaveAttribute("width", "18");
    expect(svg).toHaveAttribute("height", "18");
    expect(svg).toHaveAttribute("stroke-width", "2.4");
    expect(svg).toHaveClass("tick");
  });

  it("draws nothing for a name the design does not have", () => {
    expect(svgOf("no-such-icon")).toBeNull();
    expect(svgOf("constructor")).toBeNull();
  });
});

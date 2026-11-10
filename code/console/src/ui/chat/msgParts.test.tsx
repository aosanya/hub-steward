import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ChartLegend } from "../charts/ChartLegend";
import { percentOf, tokenCount } from "../charts/shortTokens";
import { formatMs } from "./format";
import { MsgButtons } from "./MsgButtons";
import { MsgCard } from "./MsgCard";

const show = (ui: React.ReactElement) =>
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>);

describe("MsgButtons", () => {
  it("draws nothing for no buttons", () => {
    const { container } = show(<MsgButtons buttons={[]} />);
    expect(container.querySelector(".msg-buttons")).toBeNull();
  });

  it("makes a button that calls back and is quiet unless told otherwise", async () => {
    const onClick = vi.fn();
    show(<MsgButtons buttons={[{ label: "Do it", onClick }]} />);
    const button = screen.getByRole("button", { name: "Do it" });
    expect(button).toHaveClass("quiet");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("locks a disabled button", async () => {
    const onClick = vi.fn();
    show(<MsgButtons buttons={[{ label: "Do it", onClick, disabled: true }]} />);
    await userEvent.click(screen.getByRole("button", { name: "Do it" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("makes a link when it has a place to go", () => {
    show(<MsgButtons buttons={[{ label: "Open", to: "/there" }]} />);
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/there");
  });
});

describe("MsgCard", () => {
  it("shows its title as a heading above its content", () => {
    show(<MsgCard icon="chat" title="Heads up">body</MsgCard>);
    expect(screen.getByRole("heading", { name: "Heads up", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("can leave its title out of the headings and take a tone and a class", () => {
    const { container } = show(
      <MsgCard icon="check" title="Done" tone="ok" heading={false} className="wide">
        body
      </MsgCard>,
    );
    expect(screen.queryByRole("heading")).toBeNull();
    expect(container.querySelector(".msg-card")).toHaveClass("wide");
    expect(screen.getByText("Done").closest(".msg-title")).toHaveClass("ok");
  });
});

describe("formatMs", () => {
  it("writes nothing for no time, milliseconds under a second and seconds from a second", () => {
    expect(formatMs(undefined)).toBe("");
    expect(formatMs(0)).toBe("0 ms");
    expect(formatMs(999)).toBe("999 ms");
    expect(formatMs(1000)).toBe("1.0 s");
    expect(formatMs(2450)).toBe("2.5 s");
  });
});

describe("ChartLegend", () => {
  it("lists each name and shows a value only where it has one", () => {
    const { container } = show(
      <ChartLegend
        items={[
          { name: "Input", color: "#111", value: "1,200" },
          { name: "Output", color: "#222" },
        ]}
      />,
    );
    expect(screen.getByText("Input")).toBeInTheDocument();
    expect(screen.getByText("1,200")).toBeInTheDocument();
    expect(container.querySelectorAll(".count")).toHaveLength(1);
    expect(container.querySelectorAll(".swatch")).toHaveLength(2);
  });
});

describe("token numbers", () => {
  it("groups thousands with commas", () => {
    expect(tokenCount(1234567)).toBe("1,234,567");
    expect(tokenCount(12)).toBe("12");
  });

  it("gives a share rounded to a whole percent and zero when the whole is empty", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(2, 3)).toBe(67);
    expect(percentOf(5, 0)).toBe(0);
  });
});

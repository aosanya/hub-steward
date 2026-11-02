import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Labelled } from "./Labelled";

describe("Labelled", () => {
  it("names the control it wraps and marks it required unless told not to", () => {
    const { rerender } = render(
      <Labelled id="name" label="Name">
        <input id="name" />
      </Labelled>,
    );
    expect(screen.getByLabelText(/Name/)).toBe(document.getElementById("name"));
    expect(screen.getByText("*")).toBeInTheDocument();
    rerender(
      <Labelled id="name" label="Name" required={false}>
        <input id="name" />
      </Labelled>,
    );
    expect(screen.queryByText("*")).not.toBeInTheDocument();
  });

  it("draws the error and the hint beside the control", () => {
    render(
      <Labelled id="key" label="Key" error="Pick a key" hint="Letters only">
        <input id="key" />
      </Labelled>,
    );
    expect(screen.getByText("Pick a key")).toHaveClass("field-error");
    expect(screen.getByText("Letters only")).toHaveClass("hint");
  });
});

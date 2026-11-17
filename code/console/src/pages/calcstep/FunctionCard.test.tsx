import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderPage } from "../spec/profileTesting";
import { fixtureFunctions } from "./calcStepFixture";
import { FunctionCard } from "./FunctionCard";

const open = (chosen: { name: string; version: number } | null, onChange = vi.fn()) => {
  renderPage(<FunctionCard functions={fixtureFunctions} chosen={chosen} onChange={onChange} />, "calc-step");
  return onChange;
};

describe("the function card", () => {
  it("writes the chosen function with its version and tags the version in use", () => {
    open({ name: "fin.pmt", version: 2 });
    expect(screen.getByRole("combobox", { name: "Function" })).toHaveValue("fin.pmt@2");
    expect(screen.getByText("Version in use: fin.pmt@2")).toBeInTheDocument();
  });

  it("lists every version of every function, each written with its version", () => {
    open({ name: "fin.pmt", version: 2 });
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["fin.pmt@1", "fin.pmt@2", "fin.pmt@3", "fin.rate@1", "date.late_days@1"]);
  });

  it("says a newer version exists and offers one button, and changes nothing until it is pressed", () => {
    const onChange = open({ name: "fin.pmt", version: 2 });
    expect(screen.getByText("A newer version exists: fin.pmt@3")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Use version 3" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ name: "fin.pmt", version: 3 });
  });

  it("shows no notice when the newest version is in use", () => {
    open({ name: "fin.pmt", version: 3 });
    expect(screen.queryByText(/A newer version exists/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Use version/ })).toBeNull();
  });

  it("shows no notice for a function with one version", () => {
    open({ name: "fin.rate", version: 1 });
    expect(screen.queryByText(/A newer version exists/)).toBeNull();
  });

  it("hands the picked function and version to the page", () => {
    const onChange = open({ name: "fin.pmt", version: 2 });
    fireEvent.change(screen.getByRole("combobox", { name: "Function" }), { target: { value: "fin.rate@1" } });
    expect(onChange).toHaveBeenCalledWith({ name: "fin.rate", version: 1 });
  });

  it("says no function is picked when there is none", () => {
    open(null);
    expect(screen.getByText("No function is picked yet.")).toBeInTheDocument();
    expect(screen.queryByText(/Version in use/)).toBeNull();
  });

  it("says what the chosen function does", () => {
    open({ name: "fin.pmt", version: 2 });
    expect(screen.getByText(fixtureFunctions[0].about)).toBeInTheDocument();
  });
});

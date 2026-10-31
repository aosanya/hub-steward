import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../../i18n";
import { ProgressCard } from "./ProgressCard";

const words = { en: { "review.progress": "Reading {done} of {total} parts" } };

const show = (done: number, total: number) =>
  render(
    <I18nProvider initial={words}>
      <ProgressCard progress={{ done, total }} />
    </I18nProvider>,
  );

describe("ProgressCard", () => {
  it("reads 3 of 6 parts", () => {
    show(3, 6);
    expect(screen.getByRole("status")).toHaveTextContent(/^Reading 3 of 6 parts$/);
  });

  it("starts at 0 of 5 parts", () => {
    show(0, 5);
    expect(screen.getByRole("status")).toHaveTextContent(/^Reading 0 of 5 parts$/);
  });

  it("leaves no placeholder braces in the text", () => {
    show(2, 6);
    expect(screen.getByRole("status").textContent).not.toMatch(/[{}]/);
  });

  it("shows nothing but the sentence", () => {
    const { container } = show(3, 6);
    expect(container.querySelectorAll("button, a, progress")).toHaveLength(0);
    expect(container.textContent).toBe("Reading 3 of 6 parts");
  });
});

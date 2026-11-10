import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { LoadFailed } from "./LoadFailed";

describe("the card shown when a page could not be loaded", () => {
  it("says so and tries again when asked", async () => {
    const onRetry = vi.fn();
    render(
      <I18nProvider initial={{ en: { loadFailed: "The page could not be loaded.", retry: "Try again" } }}>
        <LoadFailed onRetry={onRetry} />
      </I18nProvider>,
    );
    expect(screen.getByText("The page could not be loaded.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

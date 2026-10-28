import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../../i18n";
import { Dash, PendingNote, shortDate } from "./usersParts";

const year = new Date().getFullYear();

describe("a date shown in a table", () => {
  it("is the day and the short month for this year, in the order of the language", () => {
    expect(shortDate(`${year}-10-25T12:00:00Z`, "en")).toBe("25 Oct");
    expect(shortDate(`${year}-03-02T12:00:00Z`, "de")).toBe("2. März");
  });

  it("carries the year when it is another year", () => {
    expect(shortDate("2019-03-02T12:00:00Z", "en")).toBe("2 Mar 2019");
  });

  it("is shown as it came when it is not a date", () => {
    expect(shortDate("yesterday", "en")).toBe("yesterday");
    expect(shortDate("", "en")).toBe("");
  });
});

describe("the notes of a page", () => {
  it("says a change waits for approval, as a status", () => {
    render(
      <I18nProvider initial={{ en: { waitingForApproval: "Waiting for approval", pendingApproval: "It waits." } }}>
        <PendingNote />
      </I18nProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Waiting for approval");
    expect(screen.getByText("Waiting for approval")).toHaveClass("tag", "warn");
    expect(screen.getByText("It waits.")).toHaveClass("muted");
  });

  it("shows a dash for what is missing", () => {
    render(<Dash />);

    expect(screen.getByText("—")).toHaveClass("muted");
  });
});

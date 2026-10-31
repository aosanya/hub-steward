import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../../i18n";
import type { Finding } from "../../data/reviewApi";
import { FateChip } from "./FateChip";
import { finding } from "./reviewFixtures";

const words = {
  en: {
    "review.fate.new": "New",
    "review.fate.fixed": "Fixed",
    "review.fate.still_open": "Still open",
    "review.fate.withdrawn": "Withdrawn",
  },
};

const show = (over: Partial<Finding>) =>
  render(
    <I18nProvider initial={words}>
      <FateChip finding={finding(over)} />
    </I18nProvider>,
  );

const carried = { carried_from_id: "f-0" };

describe("FateChip", () => {
  it("renders nothing for a finding of a first review", () => {
    const { container } = show({ fate: "new", carried_from_id: "" });
    expect(container).toBeEmptyDOMElement();
  });

  it("labels a fixed finding with the ok look", () => {
    show({ ...carried, fate: "fixed", status: "applied" });
    expect(screen.getByText("Fixed")).toHaveClass("tag", "ok");
  });

  it("shows nothing for a still open finding, with or without a reason", () => {
    const bare = show({ ...carried, fate: "still_open" });
    expect(bare.container).toBeEmptyDOMElement();
    bare.unmount();
    const reasoned = show({ ...carried, fate: "still_open", status: "open", fate_reason: "The comment no longer explains it." });
    expect(reasoned.container).toBeEmptyDOMElement();
  });

  it("labels a withdrawn finding with the mute look", () => {
    show({ ...carried, fate: "withdrawn" });
    expect(screen.getByText("Withdrawn")).toHaveClass("tag", "mute");
  });

  it("labels a new finding of a later review with the plain look", () => {
    show({ ...carried, fate: "new" });
    const chip = screen.getByText("New");
    expect(chip).toHaveClass("tag");
    expect(chip).not.toHaveClass("ok", "warn", "mute", "bad");
  });

  it("shows the reason sentence beside the label", () => {
    show({ ...carried, fate: "fixed", fate_reason: "The role now has a description." });
    expect(screen.getByText("The role now has a description.")).toBeInTheDocument();
  });

  it("shows no reason when there is none", () => {
    const { container } = show({ ...carried, fate: "fixed" });
    expect(container.querySelector(".note")).toBeNull();
  });
});

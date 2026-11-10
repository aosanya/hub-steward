import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../../i18n";
import { StateChip } from "./StateChip";

const show = (state: string) =>
  render(
    <I18nProvider initial={{ en: { stateOnline: "Online", stateFault: "Fault", stateClosed: "Closed", stateAcknowledged: "Acknowledged", stateSwitchedOn: "Switched on" } }}>
      <StateChip state={state} />
    </I18nProvider>,
  );

describe("the state chip", () => {
  it("shows a good state in green with the translated word", () => {
    show("online");
    expect(screen.getByText("Online")).toHaveClass("tag", "ok");
  });

  it("shows a bad state in red", () => {
    show("fault");
    expect(screen.getByText("Fault")).toHaveClass("tag", "bad");
  });

  it("shows a closed state muted and an acknowledged one as a warning", () => {
    const first = show("closed");
    expect(screen.getByText("Closed")).toHaveClass("tag", "mute");
    first.unmount();
    show("acknowledged");
    expect(screen.getByText("Acknowledged")).toHaveClass("tag", "warn");
  });

  it("ignores the case of the state the hub sent", () => {
    show("Switched On");
    expect(screen.getByText("Switched on")).toHaveClass("ok");
  });

  it("shows a state it does not know as it came, muted", () => {
    show("sleeping");
    expect(screen.getByText("sleeping")).toHaveClass("tag", "mute");
  });

  it("does not mistake an object property name for a state", () => {
    show("constructor");
    expect(screen.getByText("constructor")).toHaveClass("mute");
  });
});

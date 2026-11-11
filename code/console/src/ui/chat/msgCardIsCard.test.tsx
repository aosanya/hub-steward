import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../../i18n";
import { ActionCard } from "../ActionCard";
import { EditCard, ListCard } from "../ContentCards";
import { FormCard } from "../FormCard";
import { MsgCard } from "./MsgCard";
import { MsgConfirm, MsgError, MsgSuggestion } from "./MsgCards";

const show = (ui: React.ReactElement) =>
  render(
    <I18nProvider initial={{}}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>
    </I18nProvider>,
  );

const partsOf = (container: HTMLElement) => {
  const card = container.querySelector("section.card") as HTMLElement;
  return { card, head: card.querySelector(":scope > .card-head") as HTMLElement, body: card.querySelector(":scope > .card-body") as HTMLElement, foot: card.querySelector(":scope > .card-foot") as HTMLElement | null };
};

describe("every message card in the chat is the shared Card", () => {
  it("MsgCard is a Card: its icon and title are the level 3 header and its children the content", () => {
    const { container } = show(<MsgCard icon="check" title="Heads up">Words</MsgCard>);
    const { card, head, body, foot } = partsOf(container);
    expect(card).toHaveClass("card", "msg-card");
    expect(head.querySelector("h3 .msg-title")).toHaveTextContent("Heads up");
    expect(screen.getByRole("heading", { name: "Heads up", level: 3 })).toBeInTheDocument();
    expect(body).toHaveTextContent("Words");
    expect(foot).toBeNull();
  });

  it("MsgCard takes a footer", () => {
    const { container } = show(<MsgCard icon="check" title="Heads up" footer={<button type="button">Go</button>}>Words</MsgCard>);
    expect(partsOf(container).foot).toHaveTextContent("Go");
  });

  it("an action card puts its buttons in the footer", () => {
    const { container } = show(<ActionCard title="Join request" text="Wanjiru wants in" buttons={[{ label: "Let in" }, { label: "Not now" }]} />);
    const { body, foot } = partsOf(container);
    expect(body).toHaveTextContent("Wanjiru wants in");
    expect(Array.from((foot as HTMLElement).children).map((one) => one.textContent)).toEqual(["Let in", "Not now"]);
    expect(body.querySelector(".msg-buttons")).toBeNull();
  });

  it("a confirm card puts confirm and cancel in the footer until it is resolved", () => {
    const first = show(<MsgConfirm title="Delete" detail="Sure?" confirm="Delete it" cancel="Keep" />);
    expect(Array.from((partsOf(first.container).foot as HTMLElement).children).map((one) => one.textContent)).toEqual(["Delete it", "Keep"]);
    first.unmount();
    const done = show(<MsgConfirm title="Delete" detail="Sure?" resolved="confirmed" />);
    expect(partsOf(done.container).foot).toBeNull();
  });

  it("a suggestion puts its actions in the footer", () => {
    const { container } = show(<MsgSuggestion text="Try this" actions={[{ label: "Open" }]} />);
    expect(partsOf(container).foot).toHaveTextContent("Open");
  });

  it("an edit card and a form card put save and cancel in the footer", () => {
    const edit = show(<EditCard title="Edit the profile" rows={[{ label: "Name", value: "Siaya" }]} />);
    expect(partsOf(edit.container).foot?.children).toHaveLength(2);
    edit.unmount();
    const form = show(<FormCard title="Add" fields={[{ label: "Name", kind: "text" }]} />);
    expect(partsOf(form.container).foot?.children).toHaveLength(2);
  });

  it("a list card keeps its rows as content and its nav button in the footer", () => {
    const { container } = show(<ListCard title="Groups" items={[{ name: "Riders" }]} nav={{ label: "Open all" }} />);
    const { body, foot } = partsOf(container);
    expect(body).toHaveTextContent("Riders");
    expect(foot).toHaveTextContent("Open all");
  });

  it("the error card is a Card without a footer", () => {
    const { container } = show(<MsgError>It broke</MsgError>);
    const card = container.querySelector(".card.msg-card.bad") as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.querySelector(".card-foot")).toBeNull();
  });
});

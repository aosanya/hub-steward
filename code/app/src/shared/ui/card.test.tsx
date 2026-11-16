import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { Card } from "./Card";

describe("Card", () => {
  it("keeps the plain card: children in one section with the card class and no header", () => {
    const { container } = render(<Card>Words</Card>);
    const card = container.querySelector("section");
    expect(card).toHaveClass("card");
    expect(card).toHaveTextContent("Words");
    expect(container.querySelector(".card-head")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps the empty card", () => {
    const { container } = render(<Card empty>Nothing here</Card>);
    expect(container.querySelector("section")).toHaveClass("card", "empty");
  });

  it("draws a header with the title and the content below it when it has a title", () => {
    const { container } = render(<Card title="Component">Body</Card>);
    expect(container.querySelector(".card-head")).toHaveTextContent("Component");
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is not collapsible without the collapsible prop: the header is not a button", () => {
    render(<Card title="Component">Body</Card>);
    expect(screen.queryByRole("button", { name: "Component" })).toBeNull();
    expect(screen.getByText("Body")).toBeVisible();
  });

  it("starts open and closes and opens again by tapping the header", async () => {
    render(<Card title="Component" collapsible>Body</Card>);
    const head = screen.getByRole("button", { name: "Component" });
    expect(head).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Body")).toBeInTheDocument();
    await userEvent.click(head);
    expect(head).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Body")).toBeNull();
    await userEvent.click(head);
    expect(head).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("starts closed when defaultOpen is false", () => {
    render(<Card title="Component" collapsible defaultOpen={false}>Body</Card>);
    expect(screen.getByRole("button", { name: "Component" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Body")).toBeNull();
  });

  it("toggles from the keyboard with Enter and Space", async () => {
    render(<Card title="Component" collapsible>Body</Card>);
    const head = screen.getByRole("button", { name: "Component" });
    head.focus();
    await userEvent.keyboard("{Enter}");
    expect(head).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard(" ");
    expect(head).toHaveAttribute("aria-expanded", "true");
  });

  it("points the chevron down when open and turns it when closed, hidden from the name", async () => {
    const { container } = render(<Card title="Component" collapsible>Body</Card>);
    const chevron = container.querySelector(".card-chevron");
    expect(chevron).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Component" })).toBeInTheDocument();
    expect(container.querySelector(".card-head")).not.toHaveClass("closed");
    await userEvent.click(screen.getByRole("button", { name: "Component" }));
    expect(container.querySelector(".card-head")).toHaveClass("closed");
  });

  it("ties the header to its content for assistive technology", () => {
    render(<Card title="Component" collapsible>Body</Card>);
    const head = screen.getByRole("button", { name: "Component" });
    const id = head.getAttribute("aria-controls");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)).toHaveTextContent("Body");
  });

  it("draws a flush card with no inner padding so rows can run edge to edge under the header", () => {
    const { container } = render(<Card title="Rows" collapsible flush>Body</Card>);
    expect(container.querySelector("section")).toHaveClass("card", "flush");
  });

  it("draws the header, the content and no footer as the three parts of a titled card", () => {
    const { container } = render(<Card title="Component">Body</Card>);
    const card = container.querySelector("section") as HTMLElement;
    expect(card.querySelector(":scope > .card-head .card-title")).toHaveTextContent("Component");
    expect(card.querySelector(":scope > .card-body")).toHaveTextContent("Body");
    expect(card.querySelector(".card-foot")).toBeNull();
  });

  it("takes a node as the title, so a card can head itself with a code and a name", () => {
    render(<Card title={<span>SW1 <b>Write</b></span>}>Body</Card>);
    expect(screen.getByText("Write")).toBeInTheDocument();
  });

  it("puts one control at the right end of the header, outside the toggle", async () => {
    const pick = vi.fn();
    const { container } = render(
      <Card title="Component" action={<button type="button" onClick={pick}>medium</button>}>
        Body
      </Card>,
    );
    const head = container.querySelector(".card-head") as HTMLElement;
    expect(head.lastElementChild).toContainElement(screen.getByRole("button", { name: "medium" }));
    await userEvent.click(screen.getByRole("button", { name: "medium" }));
    expect(pick).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".card-foot")).toBeNull();
  });

  it("keeps the toggle and the header control as two buttons on a collapsible card", async () => {
    render(
      <Card title="Component" collapsible action={<button type="button">edit</button>}>
        Body
      </Card>,
    );
    expect(screen.getByRole("button", { name: "edit" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Component" }));
    expect(screen.queryByText("Body")).toBeNull();
    expect(screen.getByRole("button", { name: "edit" })).toBeInTheDocument();
  });

  it("draws an optional footer of actions under the content, and none when it is not given", () => {
    const { container } = render(
      <Card title="Component" footer={[<button key="a" type="button">Save</button>, <button key="b" type="button">Cancel</button>]}>
        Body
      </Card>,
    );
    const foot = container.querySelector(".card > .card-foot") as HTMLElement;
    expect(foot).not.toBeNull();
    expect(Array.from(foot.children).map((one) => one.textContent)).toEqual(["Save", "Cancel"]);
    expect(foot.previousElementSibling).toHaveClass("card-body");
  });

  it("hides the footer with the content when the card is collapsed", async () => {
    const { container } = render(
      <Card title="Component" collapsible footer={[<button key="a" type="button">Save</button>]}>
        Body
      </Card>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Component" }));
    expect(container.querySelector(".card-foot")).toBeNull();
  });
});

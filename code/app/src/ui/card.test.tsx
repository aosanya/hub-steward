import { render, screen } from "@testing-library/react";
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
});

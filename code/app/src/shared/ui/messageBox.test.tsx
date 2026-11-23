import { render, screen, within } from "@testing-library/react";
import { MessageBox, type MessageTone } from "./MessageBox";

const tones: { tone: MessageTone; icon: string; heading: string }[] = [
  { tone: "error", icon: "alert", heading: "Something went wrong" },
  { tone: "warning", icon: "warning", heading: "Please note" },
  { tone: "info", icon: "info", heading: "Good to know" },
  { tone: "success", icon: "check", heading: "Done" },
];

describe("MessageBox", () => {
  it("draws an error by default: an alert in a tinted card with a round icon, a heading and the words", () => {
    const { container } = render(<MessageBox words="Rows are added through the generated workflow." />);
    const box = screen.getByRole("alert");
    expect(box.closest(".card")).toHaveClass("tone-error");
    expect(box.closest(".card")).not.toHaveClass("empty");
    expect(box.querySelector(".message-icon svg")).toHaveAttribute("data-icon", "alert");
    expect(within(box).getByText("Something went wrong")).toHaveClass("message-title");
    expect(within(box).getByText("Rows are added through the generated workflow.")).toHaveClass("message-text");
    expect(container.querySelectorAll(".card")).toHaveLength(1);
  });

  it.each(tones)("draws the $tone tone with the $icon icon and the heading $heading", ({ tone, icon, heading }) => {
    render(<MessageBox tone={tone} words="Words" />);
    const box = screen.getByRole(tone === "error" ? "alert" : "status");
    expect(box.closest(".card")).toHaveClass(`tone-${tone}`);
    expect(box.querySelector(".message-icon svg")).toHaveAttribute("data-icon", icon);
    expect(within(box).getByText(heading)).toBeInTheDocument();
  });

  it("is an alert only for errors, so the other tones do not interrupt a screen reader", () => {
    render(<MessageBox tone="warning" words="Words" />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Words");
  });

  it("takes its own heading in place of the one for the tone", () => {
    render(<MessageBox tone="info" title="Heads up" words="Words" />);
    expect(screen.getByText("Heads up")).toHaveClass("message-title");
    expect(screen.queryByText("Good to know")).toBeNull();
  });

  it("puts whatever it is given below the words", () => {
    render(
      <MessageBox words="Words">
        <button type="button">Go</button>
      </MessageBox>,
    );
    const box = screen.getByRole("alert");
    const words = within(box).getByText("Words");
    const go = within(box).getByRole("button", { name: "Go" });
    expect(words.compareDocumentPosition(go) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("says its heading in the language of the app", () => {
    window.localStorage.setItem("hub.language", "sw");
    render(<MessageBox words="Maneno" />);
    expect(screen.getByText("Kuna hitilafu")).toBeInTheDocument();
    window.localStorage.setItem("hub.language", "hu");
    render(<MessageBox words="Szavak" />);
    expect(screen.getByText("Hiba történt")).toBeInTheDocument();
  });
});

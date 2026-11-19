import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReferencePicker } from "./ReferencePicker";

const choices = [
  { value: "p1", label: "Varga Mária" },
  { value: "p2", label: "Szabó Katalin" },
  { value: "p3", label: "Takács Erzsébet" },
];

const setup = (value = "") => {
  const onChange = vi.fn();
  render(<ReferencePicker label="Holder" choices={choices} value={value} onChange={onChange} />);
  return onChange;
};

const optionNames = () => screen.queryAllByRole("option").map((option) => option.textContent?.replace(/[✓›]/g, "").trim());

describe("ReferencePicker", () => {
  it("closed it shows the chosen name and no list", () => {
    setup("p2");
    expect(screen.getByLabelText("Holder")).toHaveTextContent("Szabó Katalin");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a list titled by the field with a Search box, a back arrow and every choice as a row", async () => {
    setup();
    await userEvent.click(screen.getByLabelText("Holder"));
    const panel = screen.getByRole("dialog", { name: "Holder" });
    expect(within(panel).getByRole("heading", { name: "Holder" })).toBeInTheDocument();
    expect(within(panel).getByRole("searchbox", { name: "Search" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(optionNames()).toEqual(["Varga Mária", "Szabó Katalin", "Takács Erzsébet"]);
  });

  it("marks the chosen row and narrows the rows as the person types in Search", async () => {
    setup("p3");
    await userEvent.click(screen.getByLabelText("Holder"));
    expect(screen.getByRole("option", { name: /Takács Erzsébet/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /Varga Mária/ })).toHaveAttribute("aria-selected", "false");
    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "szab");
    expect(optionNames()).toEqual(["Szabó Katalin"]);
  });

  it("returns the chosen value and closes the list", async () => {
    const onChange = setup();
    await userEvent.click(screen.getByLabelText("Holder"));
    await userEvent.click(screen.getByRole("option", { name: /Szabó Katalin/ }));
    expect(onChange).toHaveBeenCalledWith("p2");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Back closes the list without choosing", async () => {
    const onChange = setup();
    await userEvent.click(screen.getByLabelText("Holder"));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("an empty list says so in words", async () => {
    render(<ReferencePicker label="Property" choices={[]} value="" onChange={() => undefined} />);
    await userEvent.click(screen.getByLabelText("Property"));
    expect(screen.getByText("Nothing to choose from yet.")).toBeInTheDocument();
  });

  it("a search that matches nothing says so", async () => {
    setup();
    await userEvent.click(screen.getByLabelText("Holder"));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "zzz");
    expect(screen.getByText("No match.")).toBeInTheDocument();
  });

  it("while open on a wide screen the page is marked so the form moves right of the list, and unmarked when it closes", async () => {
    setup();
    await userEvent.click(screen.getByLabelText("Holder"));
    expect(document.body).toHaveClass("reference-open");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(document.body).not.toHaveClass("reference-open");
  });

  it("unmarks the page when it is removed while open", async () => {
    const { unmount } = render(<ReferencePicker label="Holder" choices={choices} value="" onChange={vi.fn()} />);
    await userEvent.click(screen.getAllByLabelText("Holder").at(-1)!);
    expect(document.body).toHaveClass("reference-open");
    unmount();
    expect(document.body).not.toHaveClass("reference-open");
  });

  it("says Loading while the list is still being read and says it could not be read when it failed, never that there is nothing to choose", async () => {
    const { rerender } = render(<ReferencePicker label="Holder" choices={[]} status="loading" value="" onChange={vi.fn()} />);
    await userEvent.click(screen.getAllByLabelText("Holder").at(-1)!);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("Nothing to choose from yet.")).toBeNull();
    rerender(<ReferencePicker label="Holder" choices={[]} status="error" value="" onChange={vi.fn()} />);
    expect(screen.getByText("The list could not be read.")).toBeInTheDocument();
    rerender(<ReferencePicker label="Holder" choices={choices} value="" onChange={vi.fn()} />);
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });
});

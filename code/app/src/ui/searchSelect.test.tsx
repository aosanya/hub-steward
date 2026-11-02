import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchSelect } from "./SearchSelect";

const choices = [
  { value: "p1", label: "Bondo Agrovet" },
  { value: "p2", label: "Kisumu Agro Supplies" },
  { value: "p3", label: "Siaya Farm Store" },
];

const setup = (value = "", extra: { error?: string } = {}) => {
  const onChange = vi.fn();
  const view = render(
    <>
      <SearchSelect label="Supplier" choices={choices} value={value} onChange={onChange} {...extra} />
      <label>
        Product
        <input type="text" />
      </label>
      <p>Outside</p>
    </>,
  );
  return { onChange, ...view };
};

const optionNames = () => screen.queryAllByRole("option").map((option) => option.textContent);

describe("SearchSelect", () => {
  it("closed it shows the chosen name in the shared field and input classes, and no list", () => {
    setup("p2");
    const box = screen.getByLabelText("Supplier");
    expect(box).toHaveTextContent("Kisumu Agro Supplies");
    expect(box).toHaveClass("input");
    expect(box.closest(".field")).not.toBeNull();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("closed with an empty value it shows no name", () => {
    setup("");
    expect(screen.getByLabelText("Supplier").querySelector(".val")?.textContent).toBe("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closed with a value that is not among the choices it shows no name", () => {
    setup("gone");
    expect(screen.getByLabelText("Supplier").querySelector(".val")?.textContent).toBe("");
  });

  it("tapping the box opens every name, focuses the search field and marks the chosen name", async () => {
    setup("p2");
    await userEvent.click(screen.getByLabelText("Supplier"));
    expect(optionNames()).toEqual(["Bondo Agrovet", "Kisumu Agro Supplies", "Siaya Farm Store"]);
    expect(screen.getByRole("combobox")).toHaveFocus();
    expect(screen.getByRole("option", { name: "Kisumu Agro Supplies" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Bondo Agrovet" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("option", { name: "Kisumu Agro Supplies" })).toHaveClass("lopt", "on");
    expect(screen.getByRole("option", { name: "Kisumu Agro Supplies" }).querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("option", { name: "Bondo Agrovet" }).querySelector("svg")).toBeNull();
  });

  it("opens in the page flow, the list right under the box and before the next question", async () => {
    const { container } = setup("");
    await userEvent.click(screen.getByLabelText("Supplier"));
    const field = container.querySelector(".search-select") as HTMLElement;
    expect(Array.from(field.children).map((child) => child.className)).toEqual(["flabel", "input", "listbox"]);
    expect(within(field).getByRole("listbox")).toBeInTheDocument();
  });

  it("typing bo leaves Bondo Agrovet alone, and BO does the same", async () => {
    setup("");
    await userEvent.click(screen.getByLabelText("Supplier"));
    await userEvent.type(screen.getByRole("combobox"), "bo");
    expect(optionNames()).toEqual(["Bondo Agrovet"]);
    await userEvent.clear(screen.getByRole("combobox"));
    await userEvent.type(screen.getByRole("combobox"), "BO");
    expect(optionNames()).toEqual(["Bondo Agrovet"]);
  });

  it("matches the name wherever the typed text sits in it", async () => {
    setup("");
    await userEvent.click(screen.getByLabelText("Supplier"));
    await userEvent.type(screen.getByRole("combobox"), "agro");
    expect(optionNames()).toEqual(["Bondo Agrovet", "Kisumu Agro Supplies"]);
  });

  it("matches the name alone, never the value", async () => {
    setup("");
    await userEvent.click(screen.getByLabelText("Supplier"));
    await userEvent.type(screen.getByRole("combobox"), "p2");
    expect(optionNames()).toEqual([]);
  });

  it("typing a text that matches nothing leaves an empty list with no line", async () => {
    setup("");
    await userEvent.click(screen.getByLabelText("Supplier"));
    await userEvent.type(screen.getByRole("combobox"), "zzz");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByRole("listbox")).toBeEmptyDOMElement();
  });

  it("tapping a name calls onChange with its value, closes, and puts focus back on the box", async () => {
    const { onChange } = setup("");
    await userEvent.click(screen.getByLabelText("Supplier"));
    await userEvent.click(screen.getByRole("option", { name: "Siaya Farm Store" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("p3");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Supplier")).toHaveFocus();
  });

  it("reopens with the typed text cleared and every name listed", async () => {
    setup("");
    await userEvent.click(screen.getByLabelText("Supplier"));
    await userEvent.type(screen.getByRole("combobox"), "bo");
    await userEvent.click(screen.getByRole("option", { name: "Bondo Agrovet" }));
    await userEvent.click(screen.getByLabelText("Supplier"));
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(optionNames()).toHaveLength(3);
  });

  it("Escape closes without calling onChange and puts focus back on the box", async () => {
    const { onChange } = setup("p1");
    await userEvent.click(screen.getByLabelText("Supplier"));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Supplier")).toHaveFocus();
    expect(screen.getByLabelText("Supplier")).toHaveTextContent("Bondo Agrovet");
  });

  it("a tap outside closes without calling onChange", async () => {
    const { onChange } = setup("p1");
    await userEvent.click(screen.getByLabelText("Supplier"));
    await userEvent.click(screen.getByText("Outside"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Supplier")).toHaveTextContent("Bondo Agrovet");
  });

  it("a tap outside on another field leaves focus on that field", async () => {
    setup("p1");
    await userEvent.click(screen.getByLabelText("Supplier"));
    await userEvent.click(screen.getByLabelText("Product"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Product")).toHaveFocus();
  });

  it("a tap inside the box or the list does not close it", async () => {
    setup("");
    await userEvent.click(screen.getByLabelText("Supplier"));
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("Tab closes without calling onChange", async () => {
    const { onChange } = setup("");
    await userEvent.click(screen.getByLabelText("Supplier"));
    await userEvent.tab();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ArrowDown, ArrowDown and Enter choose the second name", async () => {
    const { onChange } = setup("");
    await userEvent.click(screen.getByLabelText("Supplier"));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: "Kisumu Agro Supplies" })).toHaveClass("active");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "Kisumu Agro Supplies" }).id);
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("p2");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("ArrowUp from the top goes to the last name, and ArrowDown past the last wraps to the first", async () => {
    const { onChange } = setup("");
    await userEvent.click(screen.getByLabelText("Supplier"));
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("option", { name: "Siaya Farm Store" })).toHaveClass("active");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("p1");
  });

  it("the arrows walk only the names that match", async () => {
    const { onChange } = setup("");
    await userEvent.click(screen.getByLabelText("Supplier"));
    await userEvent.type(screen.getByRole("combobox"), "agro");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("p2");
  });

  it("typing again drops the picked name, so Enter chooses nothing", async () => {
    const { onChange } = setup("");
    await userEvent.click(screen.getByLabelText("Supplier"));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await userEvent.type(screen.getByRole("combobox"), "a");
    expect(screen.queryByRole("option", { name: "Kisumu Agro Supplies" })).not.toHaveClass("active");
    await userEvent.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Enter with no name picked chooses nothing and keeps the list open", async () => {
    const { onChange } = setup("");
    await userEvent.click(screen.getByLabelText("Supplier"));
    await userEvent.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("the list is a listbox of options, and the search field controls it", async () => {
    setup("");
    await userEvent.click(screen.getByLabelText("Supplier"));
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("getByLabelText finds the control by its label, closed and open", async () => {
    setup("");
    expect(screen.getByLabelText("Supplier").tagName).toBe("BUTTON");
    await userEvent.click(screen.getByLabelText("Supplier"));
    expect(screen.getByLabelText("Supplier").tagName).toBe("INPUT");
  });

  it("draws the error under the box when it has one", () => {
    setup("", { error: "Choose the supplier." });
    expect(screen.getByText("Choose the supplier.")).toHaveClass("ferr");
    expect(screen.getByLabelText("Supplier")).toHaveClass("input", "err");
  });

  it("draws no error line and no err class without one", () => {
    const { container } = setup("");
    expect(container.querySelector(".ferr")).toBeNull();
    expect(screen.getByLabelText("Supplier")).not.toHaveClass("err");
  });
});

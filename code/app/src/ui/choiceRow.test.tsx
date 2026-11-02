import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChoiceGroup, ChoiceRow } from "./ChoiceRow";

describe("ChoiceRow", () => {
  it("is a row whose title is the label of a checkbox", async () => {
    const onChange = vi.fn();
    const { container } = render(<ChoiceRow type="checkbox" label="Depot" checked={false} onChange={onChange} />);
    expect(container.querySelector("label.row > span.ttl")?.textContent).toBe("Depot");
    await userEvent.click(screen.getByRole("checkbox", { name: "Depot" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("reports the unticking of a ticked checkbox", async () => {
    const onChange = vi.fn();
    render(<ChoiceRow type="checkbox" label="Depot" checked onChange={onChange} />);
    expect(screen.getByRole("checkbox", { name: "Depot" })).toBeChecked();
    await userEvent.click(screen.getByRole("checkbox", { name: "Depot" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("is a radio of the given name when asked", async () => {
    const onChange = vi.fn();
    render(<ChoiceRow type="radio" label="Yes" name="q1" checked={false} onChange={onChange} />);
    const radio = screen.getByRole("radio", { name: "Yes" });
    expect(radio.getAttribute("name")).toBe("q1");
    await userEvent.click(radio);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("ChoiceGroup", () => {
  it("names its rows by a legend and shows an error under them", () => {
    render(
      <ChoiceGroup label="Shops" error="Pick one">
        <ChoiceRow type="checkbox" label="Depot" checked={false} onChange={() => undefined} />
      </ChoiceGroup>,
    );
    expect(screen.getByRole("group", { name: "Shops" })).toBeTruthy();
    expect(screen.getByText("Pick one").className).toBe("ferr");
  });

  it("shows no error line without an error", () => {
    const { container } = render(
      <ChoiceGroup label="Shops">
        <ChoiceRow type="checkbox" label="Depot" checked={false} onChange={() => undefined} />
      </ChoiceGroup>,
    );
    expect(container.querySelector(".ferr")).toBeNull();
  });
});

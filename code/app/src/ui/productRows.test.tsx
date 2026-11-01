import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductRows } from "./ProductRows";

describe("ProductRows", () => {
  it("writes each product's name with its shops and the lowest price", () => {
    render(
      <ProductRows
        products={[
          { id: "a", name: "First", shops: 3, fromPrice: "KES 3,800" },
          { id: "b", name: "Second", shops: 1, fromPrice: "KES 3,400" },
          { id: "c", name: "Third", shops: 2, fromPrice: "" },
        ]}
        onOpen={() => undefined}
      />,
    );
    expect(screen.getByText("3 shops · from KES 3,800")).toBeInTheDocument();
    expect(screen.getByText("1 shop · KES 3,400")).toBeInTheDocument();
    expect(screen.getByText("2 shops")).toBeInTheDocument();
  });

  it("opens the product picked by its id", async () => {
    const onOpen = vi.fn();
    render(<ProductRows products={[{ id: "a", name: "First", shops: 1, fromPrice: "" }]} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: /^First/ }));
    expect(onOpen).toHaveBeenCalledWith("a");
  });
});

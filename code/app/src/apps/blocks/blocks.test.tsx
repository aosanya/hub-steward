import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { BlockView, fieldsFromSchema, formFromSchema } from "./index";
import type { Block, CardSpec } from "./types";

const show = (block: Block, onPrompt = vi.fn(), onTool = vi.fn().mockResolvedValue("ok")) => {
  render(
    <MemoryRouter>
      <BlockView block={block} onPrompt={onPrompt} onTool={onTool} />
    </MemoryRouter>,
  );
  return { onPrompt, onTool };
};

const card = (n: number): CardSpec => ({ id: `c${n}`, title: `Card ${n}`, lines: [`Line ${n}`], buttons: [{ label: `Open ${n}`, to: `/x/${n}` }] });

describe("text block", () => {
  it("shows the words with no sender line", () => {
    show({ kind: "text", from: "agent", text: "Hello Asha Otieno" });
    expect(screen.getByText("Hello Asha Otieno")).toBeInTheDocument();
  });

  it("marks my own bubble", () => {
    show({ kind: "text", from: "me", text: "Buy urea" });
    expect(screen.getByText("Buy urea").parentElement).toHaveClass("mine");
  });
});

describe("prompts block", () => {
  it("sends the tapped prompt", async () => {
    const { onPrompt } = show({ kind: "prompts", prompts: ["Show prices", "Sell maize"] });
    await userEvent.click(screen.getByRole("button", { name: "Sell maize" }));
    expect(onPrompt).toHaveBeenCalledWith("Sell maize");
  });
});

describe("cards block", () => {
  const cards = Array.from({ length: 7 }, (_, i) => card(i + 1));

  it("shows a few at a time and reveals the next few", async () => {
    show({ kind: "cards", cards, shown: 3 });
    expect(screen.getAllByRole("article")).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getAllByRole("article")).toHaveLength(6);
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getAllByRole("article")).toHaveLength(7);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("has no button when everything fits", () => {
    show({ kind: "cards", cards: cards.slice(0, 2), shown: 3 });
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("uses the given label for more", () => {
    show({ kind: "cards", cards, shown: 3, more: "More offers" });
    expect(screen.getByRole("button", { name: "More offers" })).toBeInTheDocument();
  });

  it("makes a link of a button with a destination", () => {
    show({ kind: "cards", cards, shown: 1 });
    expect(screen.getByRole("link", { name: "Open 1" })).toHaveAttribute("href", "/x/1");
  });

  it("sends a prompt or runs a tool from a button", async () => {
    const withActions: CardSpec = {
      id: "a",
      title: "Maize",
      lines: [],
      buttons: [
        { label: "Ask", prompt: "Tell me more about maize" },
        { label: "Join", tool: "market_join_group_order", args: { groupOrderID: "g1" } },
      ],
    };
    const { onPrompt, onTool } = show({ kind: "cards", cards: [withActions], shown: 1 });
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(onPrompt).toHaveBeenCalledWith("Tell me more about maize");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(onTool).toHaveBeenCalledWith("market_join_group_order", { groupOrderID: "g1" });
    expect(await screen.findByText("Done")).toBeInTheDocument();
  });

  it("shows the error when a tool fails", async () => {
    const failing: CardSpec = { id: "f", title: "Maize", lines: [], buttons: [{ label: "Join", tool: "t" }] };
    show({ kind: "cards", cards: [failing], shown: 1 }, vi.fn(), vi.fn().mockRejectedValue(new Error("Sale is closed")));
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sale is closed");
  });
});

describe("form block", () => {
  const form: Block = {
    kind: "form",
    tool: "market_join_group_order",
    title: "Join the group sale",
    submitLabel: "Join",
    fixedArgs: { groupOrderID: "g1" },
    fields: [
      { name: "bags", label: "Bags", kind: "number", required: true },
      { name: "note", label: "Note", kind: "text" },
      { name: "pickup", label: "Pickup", kind: "choice", options: ["Farm", "Depot"] },
    ],
  };

  it("holds the call while a required field is empty", async () => {
    const { onTool } = show(form);
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(onTool).not.toHaveBeenCalled();
  });

  it("rejects a number that is not one", async () => {
    const { onTool } = show(form);
    await userEvent.type(screen.getByLabelText("Bags"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(screen.getByText("Enter a number")).toBeInTheDocument();
    expect(onTool).not.toHaveBeenCalled();
  });

  it("submits typed values merged with the fixed arguments and shows the result", async () => {
    const { onTool } = show(form, vi.fn(), vi.fn().mockResolvedValue({ message: "You are in with 40 bags" }));
    await userEvent.type(screen.getByLabelText("Bags"), "40");
    await userEvent.click(screen.getByRole("radio", { name: "Depot" }));
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(onTool).toHaveBeenCalledWith("market_join_group_order", { bags: 40, pickup: "Depot", groupOrderID: "g1" });
    expect(await screen.findByRole("status")).toHaveTextContent("You are in with 40 bags");
    expect(screen.queryByRole("button", { name: "Join" })).toBeNull();
  });

  it("shows the error and keeps the form when the call fails", async () => {
    show(form, vi.fn(), vi.fn().mockRejectedValue(new Error("Over the limit")));
    await userEvent.type(screen.getByLabelText("Bags"), "400");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Over the limit");
    expect(screen.getByRole("button", { name: "Join" })).toBeEnabled();
  });
});

describe("schema mapping", () => {
  const schema = {
    type: "object",
    required: ["askID", "quantity"],
    properties: {
      askID: { type: "string" },
      quantity: { type: "integer" },
      price: { type: "number", title: "Price per bag" },
      needBy: { type: "string", format: "date" },
      pickup_point: { type: "string", enum: ["Farm", "Depot"] },
      tags: { type: "array" },
    },
  };

  it("maps types, formats, enums and required", () => {
    expect(fieldsFromSchema(schema)).toEqual([
      { name: "askID", label: "Ask ID", kind: "text", required: true },
      { name: "quantity", label: "Quantity", kind: "number", required: true },
      { name: "price", label: "Price per bag", kind: "number" },
      { name: "needBy", label: "Need by", kind: "date" },
      { name: "pickup_point", label: "Pickup point", kind: "choice", options: ["Farm", "Depot"] },
    ]);
  });

  it("builds a form block and leaves out fixed arguments", () => {
    const block = formFromSchema("market_post_ask", "Post an ask", schema, { askID: "a1" });
    expect(block.kind).toBe("form");
    expect(block.tool).toBe("market_post_ask");
    expect(block.fields.map((f) => f.name)).not.toContain("askID");
    expect(block.fixedArgs).toEqual({ askID: "a1" });
  });
});

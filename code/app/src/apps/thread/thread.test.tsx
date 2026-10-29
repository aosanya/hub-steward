import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Block } from "../blocks/types";
import { AppThreadPage } from "./AppThreadPage";
import { marketSource, myOrders, notListed, onSale } from "./marketSource";
import type { AgentSource } from "./source";
import type { MarketClient, Product } from "../../market/api";
import { forgetOpenAgency, openAgency } from "../../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

vi.mock("../blocks", () => ({
  BlockView: ({ block, onPrompt, onTool }: { block: Block; onPrompt: (text: string) => void; onTool: (tool: string, args: Record<string, unknown>) => Promise<unknown> }) => {
    if (block.kind === "text") return <p data-from={block.from}>{block.text}</p>;
    if (block.kind === "prompts")
      return (
        <div>
          {block.prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => onPrompt(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      );
    if (block.kind === "cards")
      return (
        <ul>
          {block.cards.map((card) => (
            <li key={card.id}>
              {card.title}
              {card.buttons.map((button) => (
                <a key={button.label} href={button.to}>
                  {button.label}
                </a>
              ))}
            </li>
          ))}
        </ul>
      );
    return (
      <button type="button" onClick={() => void onTool(block.tool, { quantity: 2 })}>
        {block.submitLabel}
      </button>
    );
  },
}));

const say = (text: string): Block => ({ kind: "text", from: "agent", text });

const sourceOf = (overrides: Partial<AgentSource> = {}): AgentSource => ({
  opening: vi.fn().mockResolvedValue([say("What do you want to buy?")]),
  reply: vi.fn().mockResolvedValue([say("Urea, DAP or CAN?")]),
  submit: vi.fn().mockResolvedValue([say("Done")]),
  ...overrides,
});

const show = (source: AgentSource) =>
  render(
    <MemoryRouter initialEntries={["/apps/buy"]}>
      <Routes>
        <Route path="/" element={<p>Do Something page</p>} />
        <Route path="/apps/buy" element={<AppThreadPage appName="Buy inputs" agentName="Farmers' agent" source={source} />} />
      </Routes>
    </MemoryRouter>,
  );

const products: Product[] = [
  { id: "urea", name: "urea", shops: 3, fromPrice: "3800" },
  { id: "dap", name: "dap", shops: 1, fromPrice: "4200" },
  { id: "can", name: "can", shops: 2, fromPrice: "3100" },
];

const clientOf = (list: Product[] = products): MarketClient => ({
  listProducts: vi.fn().mockResolvedValue(list),
  listOffers: vi.fn().mockResolvedValue([]),
  listGroupOrders: vi.fn().mockResolvedValue([]),
});

describe("AppThreadPage", () => {
  it("shows the app, its agent and no tab bar", async () => {
    show(sourceOf());
    expect(await screen.findByText("What do you want to buy?")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Buy inputs" })).toBeInTheDocument();
    expect(screen.getByText("Farmers' agent")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("holds the back link and the menu button in the bar and draws the title and the agent's name under it", async () => {
    show(sourceOf());
    await screen.findByText("What do you want to buy?");
    const bar = screen.getByRole("banner");
    const title = screen.getByRole("heading", { level: 1, name: "Buy inputs" });
    const agent = screen.getByText("Farmers' agent");
    expect(bar).toContainElement(screen.getByRole("link", { name: "Do Something" }));
    expect(bar).toContainElement(screen.getByRole("button", { name: "Menu" }));
    expect(bar).not.toContainElement(title);
    expect(bar).not.toContainElement(agent);
    expect(within(bar).queryByRole("heading")).toBeNull();
    expect(title.parentElement).toBe(agent.parentElement);
    expect(title.compareDocumentPosition(agent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bar.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(title.compareDocumentPosition(screen.getByRole("main", { name: "Thread" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("has the menu button and still no tab bar", async () => {
    show(sourceOf());
    await screen.findByText("What do you want to buy?");
    expect(screen.getByRole("banner")).toContainElement(screen.getByRole("button", { name: "Menu" }));
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("opens the account drawer from the menu button and slides the whole page, the composer included", async () => {
    show(sourceOf());
    await screen.findByText("What do you want to buy?");
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem")).toHaveLength(4);
    const page = screen.getByRole("main", { name: "Thread" }).closest(".page") as HTMLElement;
    expect(page.classList.contains("open")).toBe(true);
    expect(page).toContainElement(screen.getByRole("banner"));
    expect(page).toContainElement(screen.getByLabelText("Write to the Farmers' agent"));
    expect(page).not.toContainElement(screen.getByRole("menu"));
  });

  it("keeps the thread column inside the sliding page, the composer after the thread", async () => {
    show(sourceOf());
    await screen.findByText("What do you want to buy?");
    const column = screen.getByRole("main", { name: "Thread" }).parentElement as HTMLElement;
    expect(column.classList.contains("thread-page")).toBe(true);
    expect(column.parentElement?.classList.contains("page")).toBe(true);
    expect(column.lastElementChild).toBe(screen.getByLabelText("Write to the Farmers' agent").closest("form"));
  });

  it("goes to Your agencies from Switch agency in the drawer", async () => {
    render(
      <MemoryRouter initialEntries={["/apps/buy"]}>
        <Routes>
          <Route path="/agencies" element={<p>Your agencies page</p>} />
          <Route path="/apps/buy" element={<AppThreadPage appName="Buy inputs" agentName="Farmers' agent" source={sourceOf()} />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("What do you want to buy?");
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Switch agency/ }));
    expect(screen.getByText("Your agencies page")).toBeInTheDocument();
  });

  it("draws the title with no agent line when no agent is given", async () => {
    render(
      <MemoryRouter>
        <AppThreadPage appName="Buy inputs" source={sourceOf()} />
      </MemoryRouter>,
    );
    await screen.findByText("What do you want to buy?");
    expect(screen.getByRole("heading", { level: 1, name: "Buy inputs" }).parentElement?.querySelector(".sub")).toBeNull();
  });

  it("names no agent when none is given, and writes to the agent", async () => {
    render(
      <MemoryRouter>
        <AppThreadPage appName="Buy inputs" source={sourceOf()} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("What do you want to buy?")).toBeInTheDocument();
    expect(screen.getByLabelText("Write to the agent")).toBeInTheDocument();
    expect(screen.queryByText(/agent$/i)).not.toBeInTheDocument();
  });

  it("links back to Do Something when no way back is given", async () => {
    show(sourceOf());
    await screen.findByText("What do you want to buy?");
    await userEvent.click(screen.getByRole("link", { name: "Do Something" }));
    expect(screen.getByText("Do Something page")).toBeInTheDocument();
  });

  it("opens with the blocks the source supplies", async () => {
    const source = sourceOf();
    show(source);
    expect(await screen.findByText("What do you want to buy?")).toBeInTheDocument();
    expect(source.opening).toHaveBeenCalledTimes(1);
  });

  it("adds what she writes as her own block and then the agent's answer", async () => {
    const source = sourceOf();
    show(source);
    await screen.findByText("What do you want to buy?");
    await userEvent.type(screen.getByLabelText("Write to the Farmers' agent"), "I need fertiliser");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Urea, DAP or CAN?")).toBeInTheDocument();
    expect(screen.getByText("I need fertiliser")).toHaveAttribute("data-from", "me");
    expect(source.reply).toHaveBeenCalledWith("I need fertiliser", [say("What do you want to buy?")]);
    expect(screen.getByLabelText("Write to the Farmers' agent")).toHaveValue("");
  });

  it("keeps Send off while nothing is written", async () => {
    show(sourceOf());
    await screen.findByText("What do you want to buy?");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("sends a tapped prompt as her message", async () => {
    const source = sourceOf({
      opening: vi.fn().mockResolvedValue([{ kind: "prompts", prompts: ["My orders"] }]),
    });
    show(source);
    await userEvent.click(await screen.findByRole("button", { name: "My orders" }));
    expect(source.reply).toHaveBeenCalledWith("My orders", expect.any(Array));
    expect(await screen.findByText("Urea, DAP or CAN?")).toBeInTheDocument();
  });

  it("hands a form's arguments to the source and shows the blocks it answers with", async () => {
    const form: Block = { kind: "form", tool: "market_buy", title: "Buy", fields: [], submitLabel: "Place order" };
    const source = sourceOf({ opening: vi.fn().mockResolvedValue([form]) });
    show(source);
    await userEvent.click(await screen.findByRole("button", { name: "Place order" }));
    expect(await screen.findByText("Done")).toBeInTheDocument();
    expect(source.submit).toHaveBeenCalledWith(form, { quantity: 2 });
  });

  it("says so when the agent cannot answer", async () => {
    const source = sourceOf({ reply: vi.fn().mockRejectedValue(new Error("down")) });
    show(source);
    await screen.findByText("What do you want to buy?");
    await userEvent.type(screen.getByLabelText("Write to the Farmers' agent"), "hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("The agent could not answer. Try again.")).toBeInTheDocument();
  });

  it("says so when the opening fails", async () => {
    show(sourceOf({ opening: vi.fn().mockRejectedValue(new Error("down")) }));
    expect(await screen.findByText("The agent could not answer. Try again.")).toBeInTheDocument();
  });
});

describe("marketSource", () => {
  it("opens with a greeting, the three prompts and a card for each product linking to its page", async () => {
    const blocks = await marketSource(clientOf()).opening();
    expect(blocks[0]).toEqual(say("What do you want to buy?"));
    expect(blocks[1]).toEqual({ kind: "prompts", prompts: [onSale, notListed, myOrders] });
    const cards = blocks[2];
    expect(cards.kind).toBe("cards");
    if (cards.kind !== "cards") return;
    expect(cards.cards.map((card) => card.buttons[0].to)).toEqual(["/a/farmers/market/urea", "/a/farmers/market/dap", "/a/farmers/market/can"]);
    expect(cards.cards[0].lines).toEqual(["3 shops sell it", "From 3800 a bag"]);
    expect(cards.cards[1].lines[0]).toBe("1 shop sells it");
    expect(cards.shown).toBe(2);
  });

  it("still opens with the prompts when the market cannot be read", async () => {
    const client = clientOf();
    client.listProducts = vi.fn().mockRejectedValue(new Error("down"));
    const blocks = await marketSource(client).opening();
    expect(blocks.map((block) => block.kind)).toEqual(["text", "prompts"]);
  });

  it("answers What is on sale with the product cards", async () => {
    const blocks = await marketSource(clientOf()).reply(onSale, []);
    expect(blocks.map((block) => block.kind)).toEqual(["text", "cards"]);
  });

  it("answers Something not listed with a link to the wanted page", async () => {
    const blocks = await marketSource(clientOf()).reply(notListed, []);
    const cards = blocks[1];
    expect(cards.kind === "cards" && cards.cards[0].buttons[0].to).toBe("/buy/wanted");
  });

  it("answers My orders with a link to her orders", async () => {
    const blocks = await marketSource(clientOf()).reply(myOrders, []);
    const cards = blocks[1];
    expect(cards.kind === "cards" && cards.cards[0].buttons[0].to).toBe("/my-orders");
  });

  it("finds a product she names in her own words", async () => {
    const blocks = await marketSource(clientOf()).reply("I need Urea please", []);
    const cards = blocks[1];
    expect(cards.kind === "cards" && cards.cards.map((card) => card.id)).toEqual(["urea"]);
  });

  it("offers the wanted page when nothing matches what she wrote", async () => {
    const blocks = await marketSource(clientOf()).reply("hybrid maize seed 614", []);
    expect(blocks.map((block) => block.kind)).toEqual(["text", "cards", "prompts"]);
  });

  it("opens the thread page with the market source", async () => {
    show(marketSource(clientOf()));
    expect(await screen.findByText("urea")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: onSale }));
    await waitFor(() => expect(screen.getByText("This is what is on sale.")).toBeInTheDocument());
  });
});

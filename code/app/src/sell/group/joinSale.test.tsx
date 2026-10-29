import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as mcp from "../../wakala/mcp";
import { JoinSalePage } from "./JoinSalePage";
import { mcpSaleClient, ownLine, saleOf, type Sale, type SaleClient } from "./saleApi";

const sale: Sale = {
  id: "g1",
  product: "maize",
  productWords: "Dry maize 90kg",
  buyer: "Kisumu Grain Traders",
  price: 4350,
  minimum: 100,
  state: "open",
  total: 62,
  count: 6,
  lines: [],
};

const joined: Sale = { ...sale, total: 102, count: 7, lines: [{ picker: "m1", quantity: 40 }] };

const clientOf = (first: Sale, after: Sale = joined): SaleClient => ({
  getSale: vi.fn().mockResolvedValue(first),
  join: vi.fn().mockResolvedValue(after),
});

const show = (client: SaleClient) =>
  render(
    <MemoryRouter initialEntries={["/sell/group/g1"]}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/sell/group/:orderId" element={<JoinSalePage client={client} me="m1" />} />
      </Routes>
    </MemoryRouter>,
  );

describe("the open group sale", () => {
  it("shows the terms, the buyer, the total, the minimum and the count", async () => {
    show(clientOf(sale));
    expect(await screen.findByText("Dry maize 90kg group sale")).toBeInTheDocument();
    expect(screen.getByText("KES 4,350 a bag from 100 bags")).toBeInTheDocument();
    expect(screen.getByText("Kisumu Grain Traders")).toBeInTheDocument();
    expect(screen.getByText("62 bags so far · minimum 100 bags · 6 farmers")).toBeInTheDocument();
    expect(screen.queryByText("Your line")).not.toBeInTheDocument();
  });

  it("joins with her bags and then shows her line and the new total", async () => {
    const client = clientOf(sale);
    show(client);
    await userEvent.type(await screen.findByLabelText("Bags"), "40");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(client.join).toHaveBeenCalledWith("g1", 40);
    expect(await screen.findByText("Your line")).toBeInTheDocument();
    expect(screen.getByText("40 bags")).toBeInTheDocument();
    expect(screen.getByText("Joined")).toBeInTheDocument();
    expect(screen.getByText("102 bags so far · minimum 100 bags · 7 farmers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
  });

  it.each(["", "0", "-1", "abc", "1.5"])("refuses %j bags", async (value) => {
    const client = clientOf(sale);
    show(client);
    const field = await screen.findByLabelText("Bags");
    if (value) await userEvent.type(field, value);
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(screen.getByText("Give the bags as a whole number.")).toBeInTheDocument();
    expect(client.join).not.toHaveBeenCalled();
  });

  it("takes bags typed with a thousands comma", async () => {
    const client = clientOf(sale);
    show(client);
    await userEvent.type(await screen.findByLabelText("Bags"), "1,200");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(client.join).toHaveBeenCalledWith("g1", 1200);
  });

  it("keeps the form and says so when joining fails", async () => {
    const client = clientOf(sale);
    (client.join as any).mockRejectedValue(new Error("no"));
    show(client);
    await userEvent.type(await screen.findByLabelText("Bags"), "40");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByText("Your bags were not sent. Try again.")).toBeInTheDocument();
    expect(screen.queryByText("Your line")).not.toBeInTheDocument();
  });

  it("starts the form from her own line when she is already in", async () => {
    show(clientOf(joined));
    expect(await screen.findByLabelText("Bags")).toHaveValue("40");
    expect(screen.getByText("Joined")).toBeInTheDocument();
  });

  it("never shows another farmer's name or amount when the view carries every line", async () => {
    const everyLine: Sale = {
      ...joined,
      lines: [
        { picker: "m9", quantity: 17 },
        { picker: "m1", quantity: 40 },
        { picker: "m8", quantity: 5 },
      ],
    };
    show(clientOf(everyLine));
    expect(await screen.findByText("40 bags")).toBeInTheDocument();
    expect(screen.queryByText("17 bags")).not.toBeInTheDocument();
    expect(screen.queryByText("5 bags")).not.toBeInTheDocument();
    expect(screen.queryByText(/m9|m8/)).not.toBeInTheDocument();
  });

  it("offers no form once the sale is closed", async () => {
    show(clientOf({ ...joined, state: "closed" }));
    expect(await screen.findByText("This group sale is closed.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Bags")).not.toBeInTheDocument();
  });

  it("says when the sale could not be opened", async () => {
    const client = clientOf(sale);
    (client.getSale as any).mockRejectedValue(new Error("down"));
    show(client);
    expect(await screen.findByText("This group sale could not be opened.")).toBeInTheDocument();
  });
});

describe("the confirmed group sale", () => {
  const confirmed: Sale = { ...joined, state: "closed", total: 102, count: 7, lines: [{ picker: "m1", quantity: 40 }] };
  const withCollection = (date: string, note = ""): SaleClient => ({ ...clientOf(confirmed), collection: vi.fn().mockResolvedValue({ date, note }) });

  it("shows her share, the price, the total in KES and the day to collect", async () => {
    show(withCollection("2026-11-06", "We collect from your farm."));
    expect(await screen.findByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("40 bags")).toBeInTheDocument();
    expect(screen.getByText("KES 4,350 a bag")).toBeInTheDocument();
    expect(screen.getByText("KES 174,000")).toBeInTheDocument();
    expect(await screen.findByText("Friday, 6 Nov")).toBeInTheDocument();
    expect(screen.getByText("We collect from your farm.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Bags")).not.toBeInTheDocument();
  });

  it("shows no day to collect when none is carried", async () => {
    show(withCollection(""));
    await screen.findByText("Confirmed");
    expect(screen.queryByText("Day to collect")).not.toBeInTheDocument();
    expect(screen.queryByText("Note")).not.toBeInTheDocument();
  });

  it("still shows her share when the day to collect could not be read", async () => {
    const client = withCollection("");
    (client.collection as any).mockRejectedValue(new Error("down"));
    show(client);
    expect(await screen.findByText("KES 174,000")).toBeInTheDocument();
    expect(screen.queryByText("Day to collect")).not.toBeInTheDocument();
  });

  it("shows only that it is closed to a farmer who is not in it", async () => {
    show(clientOf({ ...confirmed, lines: [] }));
    expect(await screen.findByText("This group sale is closed.")).toBeInTheDocument();
    expect(screen.queryByText("Confirmed")).not.toBeInTheDocument();
  });
});

describe("the group sale tools", () => {
  it("does not guess the day to collect from her order's size and join time when the group sale carries none", async () => {
    const call = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string) => {
      if (tool === "market_list_orders")
        return { items: [
          { id: "or1", poster_id: "p1", product: "Dry maize 90kg", quantity: 40, state: "placed", created_at: "2026-10-29T00:00:00Z", promised_date: "2026-11-06" },
        ] } as any;
      return {} as any;
    });
    const closed = saleOf({ id: "g1", poster_id: "p1", product: "maize", state: "closed", lines: [{ picker: "m1", quantity: 40, created_at: "2026-10-28T00:00:00Z" }] });
    expect(await mcpSaleClient.collection!(closed, "m1")).toEqual({ date: "", note: "" });
    expect(call).not.toHaveBeenCalledWith("", "market_list_orders", {});
    call.mockRestore();
  });

  it("prefers the date and note the group sale carries itself", async () => {
    const closed = saleOf({ id: "g1", state: "closed", promised_date: "2026-11-13", note: "Bring the bags.", lines: [{ picker: "m1", quantity: 40 }] });
    expect(await mcpSaleClient.collection!(closed, "m1")).toEqual({ date: "2026-11-13", note: "Bring the bags." });
  });

  it("reads with groupOrderID and joins with groupOrderID and quantity", async () => {
    const call = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string) => {
      if (tool === "market_list_posters") return { items: [{ id: "p1", name: "Kisumu Grain Traders" }] } as any;
      if (tool === "market_get_group_order") return { id: "g1", poster_id: "p1", product: "Maize", price: 4350, minimum: 100, state: "open", total: 102, count: 7, lines: [{ picker: "m1", quantity: 40 }] } as any;
      return {} as any;
    });
    const got = await mcpSaleClient.join("g1", 40);
    expect(call).toHaveBeenCalledWith("", "market_join_group_order", { groupOrderID: "g1", quantity: 40 });
    expect(call).toHaveBeenCalledWith("", "market_get_group_order", { groupOrderID: "g1" });
    expect(got.buyer).toBe("Kisumu Grain Traders");
    expect(ownLine(got, "m1")?.quantity).toBe(40);
    call.mockRestore();
  });

  it("names the product by the words of the buyer's cheapest offer for it, and by the key when the offers cannot be read", async () => {
    const reading = (offers: unknown) =>
      vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string) => {
        if (tool === "market_list_offers") {
          if (offers instanceof Error) throw offers;
          return offers as any;
        }
        if (tool === "market_get_group_order") return { id: "g1", poster_id: "p1", product: "maize", price: 4350, minimum: 100, state: "open", total: 0, count: 0, lines: [] } as any;
        return { items: [] } as any;
      });
    const offers = { items: [{ poster_id: "p2", product: "maize", product_words: "MAIZE grain", price: 3900 }, { poster_id: "p1", product: "maize", product_words: "Dry maize 90kg", price: 4200 }] };
    reading(offers);
    expect((await mcpSaleClient.getSale("g1")).productWords).toBe("Dry maize 90kg");
    vi.restoreAllMocks();
    reading(new Error("not allowed"));
    expect((await mcpSaleClient.getSale("g1")).productWords).toBe("maize");
    vi.restoreAllMocks();
  });

  it("reads a sale without a line list as having none", () => {
    expect(saleOf({ id: "g1", total: "62", count: 6 }).lines).toEqual([]);
    expect(saleOf({ id: "g1", total: "62", count: 6 }).total).toBe(62);
  });
});

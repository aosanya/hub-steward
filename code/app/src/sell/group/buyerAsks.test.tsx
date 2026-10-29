import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as mcp from "../../wakala/mcp";
import type { ChatClient } from "../../chat/api";
import type { SupplyOffer } from "../../supply/api";
import { AskRoutePage, BuyerAskPage, BuyerAsksPage } from "./BuyerAsksPages";
import { askPrice, buyerAskOf, mcpBuyerAskClient, type BuyerAsk, type BuyerAskClient } from "./buyerAsksApi";

const waiting: BuyerAsk = { id: "a1", posterId: "p1", offerId: "", asker: "Asha Otieno", question: "Asha Otieno has 40 bags of maize ready", answer: "waiting", detail: "" };
const silent: BuyerAsk = { ...waiting, id: "a2", asker: "Baraka Test", question: "Baraka Test has 10 bags of maize ready", answer: "" };
const said: BuyerAsk = { ...waiting, id: "a3", asker: "Chebet Test", question: "Chebet Test has 5 bags of maize ready", answer: "yes" };

const maizeOffer: SupplyOffer = { id: "o1", supplierId: "p1", product: "Dry maize 90kg", unit: "bag", price: 4200, bulkFrom: 100, bulkPrice: 4350 };
const beansOffer: SupplyOffer = { id: "o3", supplierId: "p1", product: "Yellow beans", unit: "bag", price: 9000, bulkFrom: 0, bulkPrice: 0 };

const clientOf = (asks: BuyerAsk[], offers: SupplyOffer[] = []): BuyerAskClient => ({
  list: vi.fn().mockResolvedValue(asks),
  offers: vi.fn().mockResolvedValue(offers),
  answer: vi.fn().mockResolvedValue(undefined),
});

const show = (entry: string, client: BuyerAskClient) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/prices" element={<p>prices</p>} />
        <Route path="/sell/asks" element={<BuyerAsksPage client={client} />} />
        <Route path="/sell/asks/:askId" element={<BuyerAskPage client={client} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("the buyer's asks", () => {
  it("lists waiting asks first, counts silence as waiting, and answered ones under Answered", async () => {
    show("/sell/asks", clientOf([waiting, silent, said]));
    expect(await screen.findByText("Asha Otieno has 40 bags of maize ready")).toBeInTheDocument();
    expect(screen.getByText("Baraka Test has 10 bags of maize ready")).toBeInTheDocument();
    expect(screen.getByText("Answered")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("says when no ask is waiting", async () => {
    show("/sell/asks", clientOf([said]));
    expect(await screen.findByText("No asks are waiting.")).toBeInTheDocument();
  });

  it("says when the asks could not be loaded", async () => {
    const client = clientOf([]);
    (client.list as any).mockRejectedValue(new Error("down"));
    show("/sell/asks", client);
    expect(await screen.findByText("The asks could not be loaded.")).toBeInTheDocument();
  });

  it("opens an ask from the list", async () => {
    show("/sell/asks", clientOf([waiting]));
    await userEvent.click(await screen.findByRole("button", { name: /Asha Otieno/ }));
    expect(await screen.findByRole("button", { name: "Yes" })).toBeInTheDocument();
  });
});

describe("answering an ask", () => {
  it("answers nothing by itself: opening an ask sends no answer", async () => {
    const client = clientOf([waiting]);
    show("/sell/asks/a1", client);
    expect(await screen.findByText("Asha Otieno has 40 bags of maize ready")).toBeInTheDocument();
    expect(client.answer).not.toHaveBeenCalled();
  });

  it("answers yes only with a date and carries the note", async () => {
    const client = clientOf([waiting]);
    show("/sell/asks/a1", client);
    await userEvent.click(await screen.findByRole("button", { name: "Yes" }));
    const send = screen.getByRole("button", { name: "Send yes" });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Date"), "2026-11-06");
    await userEvent.type(screen.getByLabelText("Note"), "We collect from your farm.");
    await userEvent.click(send);
    expect(client.answer).toHaveBeenCalledWith("a1", { answer: "yes", date: "2026-11-06", note: "We collect from your farm." });
    expect(await screen.findByText("You said yes.")).toBeInTheDocument();
    expect(screen.getByText("Friday, 6 Nov")).toBeInTheDocument();
    expect(screen.getByText("We collect from your farm.")).toBeInTheDocument();
  });

  it("answers no in one tap", async () => {
    const client = clientOf([waiting]);
    show("/sell/asks/a1", client);
    await userEvent.click(await screen.findByRole("button", { name: "No" }));
    expect(client.answer).toHaveBeenCalledWith("a1", { answer: "no" });
    expect(await screen.findByText("You said no.")).toBeInTheDocument();
  });

  it("keeps the ask open and says so when the answer fails", async () => {
    const client = clientOf([waiting]);
    (client.answer as any).mockRejectedValue(new Error("no"));
    show("/sell/asks/a1", client);
    await userEvent.click(await screen.findByRole("button", { name: "No" }));
    expect(await screen.findByText("The answer was not sent. Try again.")).toBeInTheDocument();
    expect(screen.queryByText("You said no.")).not.toBeInTheDocument();
  });

  it("shows an already answered ask as answered, with no buttons", async () => {
    show("/sell/asks/a3", clientOf([said]));
    expect(await screen.findByText("You said yes.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "No" })).not.toBeInTheDocument();
  });

  it("says when the ask is not among his", async () => {
    show("/sell/asks/zzz", clientOf([waiting]));
    expect(await screen.findByText("The ask could not be found.")).toBeInTheDocument();
  });
});

describe("the price on an ask", () => {
  it("shows his price a bag and the total for the bags the farmer has", async () => {
    show("/sell/asks/a1", clientOf([waiting], [beansOffer, maizeOffer]));
    expect(await screen.findByText("KES 4,200 a bag")).toBeInTheDocument();
    expect(screen.getByText("Your price · KES 168,000 in all")).toBeInTheDocument();
  });

  it("uses the bulk price from the bulk quantity", () => {
    const big = { ...waiting, question: "Asha Otieno has 100 bags of maize ready" };
    expect(askPrice(big, [maizeOffer])).toEqual({ quantity: 100, unitWords: "KES 4,350 a bag", totalWords: "KES 435,000 in all" });
  });

  it("takes the offer the ask names before matching words", () => {
    const named = { ...waiting, question: "Asha Otieno has 3 bags ready", offerId: "o3" };
    expect(askPrice(named, [maizeOffer, beansOffer])?.totalWords).toBe("KES 27,000 in all");
  });

  it("matches by the ask's words, since the ask has no product field", () => {
    expect(askPrice(waiting, [beansOffer, maizeOffer])?.unitWords).toBe("KES 4,200 a bag");
  });

  it("ignores offers of another poster", () => {
    expect(askPrice(waiting, [{ ...maizeOffer, supplierId: "p2" }])).toBeNull();
  });

  it("shows no price when no offer matches the words or the ask has no number", () => {
    expect(askPrice(waiting, [beansOffer])).toBeNull();
    expect(askPrice({ ...waiting, question: "Asha Otieno has maize ready" }, [maizeOffer])).toBeNull();
  });

  it("still shows the ask when the offers could not be read", async () => {
    const client = clientOf([waiting], [maizeOffer]);
    (client.offers as any).mockRejectedValue(new Error("down"));
    show("/sell/asks/a1", client);
    expect(await screen.findByText("Asha Otieno has 40 bags of maize ready")).toBeInTheDocument();
    expect(screen.queryByText(/in all/)).toBeNull();
  });
});

describe("the ask tools", () => {
  const posters = { items: [{ id: "p1", owner: "m1", name: "Kisumu Grain Traders" }, { id: "p2", owner: "m2", name: "Other" }] };
  const asks = {
    items: [
      { id: "a1", poster_id: "p1", picker: "m5", picker_name: "Asha Otieno", question: "40 bags", answer: "waiting" },
      { id: "a2", poster_id: "p2", picker: "m5", picker_name: "Asha Otieno", question: "for someone else", answer: "waiting" },
      { id: "a3", poster_id: "p9", picker: "m1", picker_name: "Buyer Test", question: "his own ask to a shop", answer: "waiting" },
    ],
  };

  it("lists only the asks put to his own posters", async () => {
    const call = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string) => (tool === "market_list_posters" ? posters : asks) as any);
    const got = await mcpBuyerAskClient.list("m1");
    expect(got.map((a) => a.id)).toEqual(["a1"]);
    expect(got[0].asker).toBe("Asha Otieno");
    call.mockRestore();
  });

  it("lists nothing when the member is unknown", async () => {
    const call = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string) => (tool === "market_list_posters" ? posters : asks) as any);
    expect(await mcpBuyerAskClient.list("nobody")).toEqual([]);
    call.mockRestore();
  });

  it("lists the offers of his own posters only", async () => {
    const call = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string, args: any) =>
      (tool === "market_list_posters" ? posters : { items: [{ id: `o-${args.poster_id}`, poster_id: args.poster_id, product_words: "Maize", price: 1 }] }) as any,
    );
    const got = await mcpBuyerAskClient.offers!("m1");
    expect(got.map((o) => o.id)).toEqual(["o-p1"]);
    expect(call).toHaveBeenCalledWith("", "market_list_offers", { poster_id: "p1" });
    call.mockRestore();
  });

  it("answers through market_answer_ask with askID, answer, date and note", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({} as any);
    await mcpBuyerAskClient.answer("a1", { answer: "yes", date: "2026-11-06", note: "Collect" });
    expect(call).toHaveBeenCalledWith("", "market_answer_ask", { askID: "a1", answer: "yes", date: "2026-11-06", note: "Collect" });
    call.mockRestore();
  });

  it("reads the asker's name before the id", () => {
    expect(buyerAskOf({ id: "a", picker: "m5", picker_name: "Asha Otieno" }).asker).toBe("Asha Otieno");
    expect(buyerAskOf({ id: "a", picker: "m5" }).asker).toBe("m5");
  });
});

describe("the ask under the shared ask address", () => {
  it("shows the buyer's own ask with his price and total, and goes back to the shared asks list", async () => {
    render(
      <MemoryRouter initialEntries={["/asks/a1"]}>
        <Routes>
          <Route path="/asks" element={<p>shared asks</p>} />
          <Route path="/asks/:askId" element={<AskRoutePage client={clientOf([waiting], [maizeOffer])} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Your price · KES 168,000 in all")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(await screen.findByText("shared asks")).toBeInTheDocument();
  });

  it("loads the asks once when opening an ask from the shared list", async () => {
    const client = clientOf([waiting], [maizeOffer]);
    render(
      <MemoryRouter initialEntries={["/asks/a1"]}>
        <Routes>
          <Route path="/asks/:askId" element={<AskRoutePage client={client} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Your price · KES 168,000 in all")).toBeInTheDocument();
    expect(client.list).toHaveBeenCalledTimes(1);
  });

  it("shows the plain ask page for an ask that is not among the poster's own", async () => {
    const chat = { listRooms: vi.fn(), listThreads: vi.fn(), listMessages: vi.fn(), sendMessage: vi.fn(), getAsk: vi.fn().mockResolvedValue({ ...said, id: "z9", question: "Zed Test has 3 bags of rice ready", answer: "" }), answerAsk: vi.fn() } as unknown as ChatClient;
    render(
      <MemoryRouter initialEntries={["/asks/z9"]}>
        <Routes>
          <Route path="/asks/:askId" element={<AskRoutePage client={clientOf([waiting], [maizeOffer])} chat={chat} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Zed Test has 3 bags of rice ready/)).toBeInTheDocument();
    expect(screen.queryByText(/Your price/)).not.toBeInTheDocument();
    expect(chat.getAsk).toHaveBeenCalledWith("z9");
  });

  const chatOf = (ask: BuyerAsk) =>
    ({ listRooms: vi.fn(), listThreads: vi.fn(), listMessages: vi.fn(), sendMessage: vi.fn(), getAsk: vi.fn().mockResolvedValue(ask), answerAsk: vi.fn() }) as unknown as ChatClient;

  const open = (client: BuyerAskClient, chat: ChatClient, me: string, askId = "a1") =>
    render(
      <MemoryRouter initialEntries={[`/asks/${askId}`]}>
        <Routes>
          <Route path="/asks/:askId" element={<AskRoutePage client={client} chat={chat} me={me} />} />
        </Routes>
      </MemoryRouter>,
    );

  it("shows the supplier's page for an ask on the caller's poster that has no price of the caller's", async () => {
    const chat = chatOf(waiting);
    open(clientOf([waiting], []), chat, "m1");
    expect(await screen.findByText(/Asha Otieno has 40 bags of maize ready/)).toBeInTheDocument();
    expect(screen.queryByText(/Your price/)).not.toBeInTheDocument();
    expect(chat.getAsk).toHaveBeenCalledWith("a1");
  });

  it("shows the buyer's page with the price for an ask on the caller's own offer", async () => {
    const chat = chatOf(waiting);
    open(clientOf([waiting], [maizeOffer]), chat, "m1");
    expect(await screen.findByText("Your price · KES 168,000 in all")).toBeInTheDocument();
    expect(chat.getAsk).not.toHaveBeenCalled();
  });

  it("reads the asks list once and never flashes not found for an ask that was found", async () => {
    const client = clientOf([waiting], [maizeOffer]);
    open(client, chatOf(waiting), "m1");
    expect(screen.queryByText("The ask could not be found.")).not.toBeInTheDocument();
    expect(await screen.findByText("Your price · KES 168,000 in all")).toBeInTheDocument();
    expect(screen.queryByText("The ask could not be found.")).not.toBeInTheDocument();
    expect(client.list).toHaveBeenCalledTimes(1);
    expect(client.offers).toHaveBeenCalledTimes(1);
  });
});

import { afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import * as mcp from "../../wakala/mcp";
import { OneAskPage } from "./AsksPage";
import { liveStock } from "./liveStock";

const ask = (question: string) => ({ id: "a1", asker: "Asha Otieno", question, answer: "waiting", detail: "" });

const reply = (stock: any[], yeses: any[]) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_s: string, tool: string) => {
    if (tool === "market_list_posters") return { items: [{ id: "p1", owner: "m1", status: "approved" }] } as any;
    if (tool === "market_get_stock") return { items: stock } as any;
    if (tool === "market_list_yeses") return { items: yeses } as any;
    return {} as any;
  });

const showAsk = (question: string) => {
  const client: any = { getAsk: async () => ask(question), answerAsk: vi.fn() };
  render(
    <MemoryRouter initialEntries={["/asks/a1"]}>
      <Routes>
        <Route path="/asks/:askId" element={<OneAskPage client={client} readStock={liveStock} />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("the ask page reads his real list", () => {
  afterEach(() => vi.restoreAllMocks());

  it("counts only the asked product when he lists several", async () => {
    window.localStorage.setItem("hubsteward.member", "m1");
    reply(
      [{ product: "Urea 50kg", count: 40 }, { product: "DAP 50kg", count: 25 }],
      [
        { id: "y1", what: "Urea 50kg", quantity: 2, state: "open" },
        { id: "y2", what: "DAP 50kg", quantity: 6, state: "open" },
      ],
    );
    showAsk("2 bags of Urea 50kg");
    expect(await screen.findByText("Your list: 40 bags. Already promised: 2 bags")).toBeInTheDocument();
  });

  it("shows no line when several products are listed and the ask names none of them", async () => {
    window.localStorage.setItem("hubsteward.member", "m1");
    reply([{ product: "Urea 50kg", count: 40 }, { product: "DAP 50kg", count: 25 }], []);
    showAsk("Hybrid maize seed 614, 10 kg");
    await screen.findByText("Hybrid maize seed 614, 10 kg");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText(/Your list/)).toBeNull();
  });

  it("shows the one product he lists when the ask names none", async () => {
    window.localStorage.setItem("hubsteward.member", "m1");
    reply([{ product: "Urea 50kg", count: 40 }], []);
    showAsk("Fertiliser for Friday");
    expect(await screen.findByText("Your list: 40 bags. Already promised: 0 bags")).toBeInTheDocument();
  });

  it("shows his list and what he already promised from the tools", async () => {
    window.localStorage.setItem("hubsteward.member", "m1");
    vi.spyOn(mcp, "callTool").mockImplementation(async (_s: string, tool: string) => {
      if (tool === "market_list_posters") return { items: [{ id: "p1", owner: "m1", status: "approved" }] } as any;
      if (tool === "market_get_stock") return { items: [{ product: "urea", count: 40 }] } as any;
      if (tool === "market_list_yeses") return { items: [{ id: "y1", what: "urea", quantity: 2, state: "open" }, { id: "y2", what: "urea", quantity: 9, state: "delivered" }] } as any;
      return {} as any;
    });
    const client: any = { getAsk: async () => ({ id: "a1", asker: "Asha Otieno", question: "2 bags of urea", answer: "waiting", detail: "" }), answerAsk: vi.fn() };
    render(
      <MemoryRouter initialEntries={["/asks/a1"]}>
        <Routes>
          <Route path="/asks/:askId" element={<OneAskPage client={client} readStock={liveStock} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Your list: 40 bags. Already promised: 2 bags")).toBeInTheDocument();
  });
});

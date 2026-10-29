import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AskedPage } from "./AskedPage";
import { AskShopsPage } from "./AskShopsPage";
import { NoticePage } from "./NoticePage";
import { WantedPage } from "./WantedPage";
import type { WantedClient } from "./api";
import { isListed } from "./unlisted";
import { routes } from "../../routes";
import { forgetOpenAgency, openAgency } from "../../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const open = { id: "n1", what: "Hybrid maize seed 614", quantity: "10", neededBy: "2026-11-06", open: true };

const client = (over: Partial<WantedClient> = {}): WantedClient => ({
  createWanted: vi.fn().mockResolvedValue("r1"),
  listShops: vi.fn().mockResolvedValue([{ id: "p1", name: "Siaya Farm Stores" }]),
  ask: vi.fn().mockResolvedValue(undefined),
  listAsked: vi.fn().mockResolvedValue([]),
  listFound: vi.fn().mockResolvedValue([]),
  listOffers: vi.fn().mockResolvedValue([{ id: "o1", product: "Urea 50kg", words: "", price: 3800, unit: "bag" }]),
  createNotice: vi.fn().mockResolvedValue("n1"),
  listNotices: vi.fn().mockResolvedValue([open]),
  withdrawNotice: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const show = (c: WantedClient, entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/buy/wanted" element={<WantedPage client={c} />} />
        <Route path="/buy/wanted/:requestId/ask" element={<AskShopsPage client={c} />} />
        <Route path="/buy/wanted/:requestId" element={<AskedPage client={c} />} />
        <Route path="/buy/notices/:noticeId" element={<NoticePage client={c} />} />
        <Route path="/apps/buy" element={<p>buy inputs thread</p>} />
        <Route path={routes.market.pattern} element={<p>market page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("taking a notice down", () => {
  it("takes it down only when she taps, then opens Buy inputs", async () => {
    const c = client();
    show(c, "/buy/notices/n1");
    await screen.findByText("Hybrid maize seed 614");
    expect(c.withdrawNotice).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Take it down" }));
    expect(c.withdrawNotice).toHaveBeenCalledTimes(1);
    expect(c.withdrawNotice).toHaveBeenCalledWith("n1");
    expect(await screen.findByText("buy inputs thread")).toBeInTheDocument();
  });

  it("styles Take it down as the danger button", async () => {
    show(client(), "/buy/notices/n1");
    expect(await screen.findByRole("button", { name: "Take it down" })).toHaveClass("danger");
  });

  it("stays on the notice and offers the button again when taking it down fails", async () => {
    const c = client({ withdrawNotice: vi.fn().mockRejectedValue(new Error("x")) });
    show(c, "/buy/notices/n1");
    await userEvent.click(await screen.findByRole("button", { name: "Take it down" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The notice is still up. Try again.");
    expect(screen.getByRole("button", { name: "Take it down" })).toBeEnabled();
    expect(screen.queryByText("buy inputs thread")).toBeNull();
  });

  it("goes back to Buy inputs", async () => {
    show(client(), "/buy/notices/n1");
    await screen.findByText("Hybrid maize seed 614");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("buy inputs thread")).toBeInTheDocument();
  });

  it("picks its own notice out of every open one", async () => {
    const other = { id: "n2", what: "Urea", quantity: "", neededBy: "", open: true };
    show(client({ listNotices: vi.fn().mockResolvedValue([other, open]) }), "/buy/notices/n1");
    expect(await screen.findByText("Hybrid maize seed 614")).toBeInTheDocument();
    expect(screen.queryByText("Urea")).toBeNull();
  });
});

describe("something not listed", () => {
  it("has the agent say no shop has listed what she typed, without typing a name for it", async () => {
    show(client(), "/buy/wanted");
    expect(screen.queryByText(/No shop has listed/)).toBeNull();
    await userEvent.type(screen.getByLabelText("What"), "Hybrid maize seed 614");
    expect(await screen.findByText("No shop has listed Hybrid maize seed 614.")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.queryByText("Farmers' agent")).not.toBeInTheDocument();
  });

  it("stays quiet when a shop has listed it", async () => {
    show(client(), "/buy/wanted");
    await screen.findByLabelText("What");
    await userEvent.type(screen.getByLabelText("What"), "Urea");
    expect(screen.queryByText(/No shop has listed/)).toBeNull();
  });

  it("stays quiet when the listings could not be read", async () => {
    show(client({ listOffers: vi.fn().mockRejectedValue(new Error("x")) }), "/buy/wanted");
    await userEvent.type(screen.getByLabelText("What"), "Hybrid maize seed 614");
    expect(screen.queryByText(/No shop has listed/)).toBeNull();
  });

  it("goes back to Buy inputs", async () => {
    show(client(), "/buy/wanted");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("buy inputs thread")).toBeInTheDocument();
  });

  it("comes back from Ask shops with what she had typed", async () => {
    show(client(), "/buy/wanted/r1/ask?what=Hybrid+maize+seed+614&quantity=10&by=2026-11-06");
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("What")).toHaveValue("Hybrid maize seed 614");
    expect(screen.getByLabelText("How much")).toHaveValue("10");
    expect(screen.getByLabelText("Needed by")).toHaveValue("2026-11-06");
  });

  it("puts up a notice with exactly what she typed", async () => {
    const c = client();
    show(c, "/buy/wanted?what=Hybrid+maize+seed+614&quantity=10&by=2026-11-06");
    await userEvent.click(screen.getByRole("button", { name: "Put up a notice" }));
    expect(c.createNotice).toHaveBeenCalledWith({ what: "Hybrid maize seed 614", quantity: "10", neededBy: "2026-11-06" });
    expect(await screen.findByText("Your notice")).toBeInTheDocument();
  });
});

describe("the asked page", () => {
  it("goes back to Buy inputs", async () => {
    show(client(), "/buy/wanted/r1?what=Seed&quantity=&by=");
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(screen.getByText("buy inputs thread")).toBeInTheDocument();
  });
});

describe("isListed", () => {
  const offers = [{ id: "o1", product: "Urea 50kg", words: "", price: 1, unit: "" }];
  it("matches either way round, ignoring case", () => {
    expect(isListed("urea", offers)).toBe(true);
    expect(isListed("UREA 50KG bags", offers)).toBe(true);
  });
  it("is false for nothing typed or nothing like it", () => {
    expect(isListed("  ", offers)).toBe(false);
    expect(isListed("Hybrid maize seed 614", offers)).toBe(false);
    expect(isListed("Urea", [{ id: "o2", product: "", words: "", price: 1, unit: "" }])).toBe(false);
  });
});

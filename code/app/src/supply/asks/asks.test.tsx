import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { isWaiting, type Ask, type ChatClient } from "../../chat/api";
import { AsksPage, OneAskPage } from "./AsksPage";
import { stockText } from "./stock";

const waiting: Ask = { id: "a1", asker: "Asha Otieno", question: "2 bags of urea by Friday", answer: "waiting", detail: "" };
const yes: Ask = { id: "a2", asker: "Baraka", question: "5 bags of seed", answer: "yes", detail: "" };
const no: Ask = { id: "a3", asker: "Chao", question: "1 bag of lime", answer: "no", detail: "" };

const client = (ask: Ask): ChatClient => ({
  listRooms: vi.fn().mockResolvedValue([]),
  listMessages: vi.fn().mockResolvedValue([]),
  getAsk: vi.fn().mockResolvedValue(ask),
  answerAsk: vi.fn().mockResolvedValue(undefined),
});

const showList = (asks: Ask[]) =>
  render(
    <MemoryRouter initialEntries={["/asks"]}>
      <Routes>
        <Route path="/asks" element={<AsksPage source={async () => asks} />} />
        <Route path="/asks/:askId" element={<p>one ask</p>} />
      </Routes>
    </MemoryRouter>,
  );

const showOne = (c: ChatClient, readStock?: () => Promise<any>) =>
  render(
    <MemoryRouter initialEntries={["/asks/a1"]}>
      <Routes>
        <Route path="/asks/:askId" element={<OneAskPage client={c} readStock={readStock} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("asks waiting and answered", () => {
  it("counts silence as waiting, with no timer", () => {
    expect(isWaiting(waiting)).toBe(true);
    expect(isWaiting({ ...waiting, answer: "" })).toBe(true);
    expect(isWaiting(yes)).toBe(false);
  });

  it("lists waiting asks first and answered ones on their tab", async () => {
    showList([waiting, yes, no]);
    expect(await screen.findByText("2 bags of urea by Friday")).toBeInTheDocument();
    expect(screen.queryByText("5 bags of seed")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Answered" }));
    expect(screen.getByText("5 bags of seed")).toBeInTheDocument();
    expect(screen.getByText("1 bag of lime")).toBeInTheDocument();
    expect(screen.queryByText("2 bags of urea by Friday")).toBeNull();
  });

  it("counts the asks waiting on the Waiting tab, and only when some wait", async () => {
    showList([waiting, { ...waiting, id: "a4" }, yes]);
    expect(await screen.findByRole("button", { name: "Waiting · 2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Answered" })).toBeInTheDocument();
  });

  it("says so when nothing waits", async () => {
    showList([yes]);
    expect(await screen.findByText("No asks are waiting.")).toBeInTheDocument();
  });

  it("says No asks answered yet. in an empty card on the Answered tab when none is answered, and not the waiting line", async () => {
    showList([waiting]);
    await userEvent.click(await screen.findByRole("button", { name: "Answered" }));
    expect(screen.getByText("No asks answered yet.").closest(".card")).toHaveClass("empty");
    expect(screen.queryByText("No asks are waiting.")).toBeNull();
    expect(screen.queryByText("2 bags of urea by Friday")).toBeNull();
  });

  it("opens one ask", async () => {
    showList([waiting]);
    await userEvent.click(await screen.findByRole("button", { name: /2 bags of urea/ }));
    expect(screen.getByText("one ask")).toBeInTheDocument();
  });

  it("shows his list beside the ask only when it can be read", async () => {
    const stock = async () => ({ listed: 40, promised: 2, unit: "bags" });
    showOne(client(waiting), stock);
    expect(await screen.findByText(stockText({ listed: 40, promised: 2, unit: "bags" }))).toBeInTheDocument();
    expect(screen.getByText("Your list: 40 bags. Already promised: 2 bags")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Only you see this" })).toBeInTheDocument();
  });

  it("asks the stock reader about this ask's own words", async () => {
    const stock = vi.fn().mockResolvedValue(null);
    showOne(client({ ...waiting, detail: "Needed by Friday" }), stock);
    await screen.findByText("2 bags of urea by Friday");
    expect(stock).toHaveBeenCalledWith({ question: "2 bags of urea by Friday", detail: "Needed by Friday" });
  });

  it("shows no list line when there is no stock list", async () => {
    showOne(client(waiting));
    await screen.findByText("2 bags of urea by Friday");
    expect(screen.queryByText(/Your list/)).toBeNull();
    expect(screen.queryByText("Only you see this")).toBeNull();
  });

  it("will not send Yes without a date", async () => {
    const c = client(waiting);
    showOne(c);
    await userEvent.click(await screen.findByRole("button", { name: "Yes" }));
    expect(screen.getByRole("button", { name: "Send yes" })).toBeDisabled();
    expect(c.answerAsk).not.toHaveBeenCalled();
  });

  it("heads the Yes form with the asker's name", async () => {
    showOne(client(waiting));
    await userEvent.click(await screen.findByRole("button", { name: "Yes" }));
    expect(screen.getByRole("heading", { name: "Yes to Asha Otieno" })).toBeInTheDocument();
  });

  it("heads the Yes form with a bare Yes when the asker has no name", async () => {
    showOne(client({ ...waiting, asker: "" }));
    await userEvent.click(await screen.findByRole("button", { name: "Yes" }));
    expect(screen.getByRole("heading", { name: "Yes" })).toBeInTheDocument();
  });

  it("shows the answer sent, with its date and note, once it is sent", async () => {
    showOne(client(waiting));
    await userEvent.click(await screen.findByRole("button", { name: "Yes" }));
    await userEvent.type(screen.getByLabelText("Date"), "2026-11-06");
    await userEvent.type(screen.getByLabelText("Note"), "Collect at the shop");
    await userEvent.click(screen.getByRole("button", { name: "Send yes" }));
    expect(await screen.findByRole("heading", { name: "Your answer" })).toBeInTheDocument();
    expect(screen.getByText("Friday, 6 Nov")).toBeInTheDocument();
    expect(screen.getByText("Collect at the shop")).toBeInTheDocument();
    expect(screen.getByText("Yes", { selector: ".chip" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send yes" })).toBeNull();
  });

  it("shows a No answer plainly", async () => {
    showOne(client(waiting));
    await userEvent.click(await screen.findByRole("button", { name: "No" }));
    expect(await screen.findByText("You said no.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your answer" })).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("shows an earlier answer by its word alone", async () => {
    showOne(client(yes));
    expect(await screen.findByText("You said yes.")).toBeInTheDocument();
    expect(screen.queryByText("Your answer")).toBeNull();
  });

  it("sends Yes with a date and a note", async () => {
    const c = client(waiting);
    showOne(c);
    await userEvent.click(await screen.findByRole("button", { name: "Yes" }));
    await userEvent.type(screen.getByLabelText("Date"), "2026-11-06");
    await userEvent.type(screen.getByLabelText("Note"), "Friday morning");
    await userEvent.click(screen.getByRole("button", { name: "Send yes" }));
    expect(c.answerAsk).toHaveBeenCalledWith("a1", { answer: "yes", date: "2026-11-06", note: "Friday morning" });
  });

  it("sends No alone", async () => {
    const c = client(waiting);
    showOne(c);
    await userEvent.click(await screen.findByRole("button", { name: "No" }));
    expect(c.answerAsk).toHaveBeenCalledWith("a1", { answer: "no" });
  });

  it("stays unanswered and says so when sending fails", async () => {
    const c = client(waiting);
    (c.answerAsk as any).mockRejectedValue(new Error("x"));
    showOne(c);
    await userEvent.click(await screen.findByRole("button", { name: "No" }));
    expect(await screen.findByText("The answer was not sent. Try again.")).toBeInTheDocument();
    expect(screen.queryByText("Your answer")).toBeNull();
  });
});

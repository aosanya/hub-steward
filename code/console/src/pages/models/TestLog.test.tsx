import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import words from "../../../public/i18n.json";
import { I18nProvider } from "../../i18n";
import { TestLog } from "./TestLog";
import type { TestRun } from "./useTestRun";

afterEach(() => {
  localStorage.clear();
});

const done = (fields: Partial<Extract<TestRun, { phase: "done" }>> = {}): TestRun => ({
  phase: "done",
  working: true,
  reason: "",
  prompt: "Reply with the single word OK",
  reply: "OK",
  tookMs: 320,
  ...fields,
});

const show = (run: TestRun, provider = "Claude"): ReactNode => (
  <I18nProvider initial={words}>
    <TestLog run={run} provider={provider} />
  </I18nProvider>
);

describe("the test log", () => {
  it("renders nothing before a test is run", () => {
    const { container } = render(show({ phase: "idle" }));

    expect(container).toBeEmptyDOMElement();
  });

  it("says a short message is going out to the provider while sending, and nothing else", () => {
    render(show({ phase: "sending" }, "Hugging Face"));

    const log = screen.getByRole("status");
    expect(log).toHaveTextContent("Sending a short message to Hugging Face…");
    expect(screen.queryByText(/Sent:/)).not.toBeInTheDocument();
    expect(log.querySelector(".mk-result")).toBeNull();
  });

  it("shows what was sent and what answered, with the time, in one status block", () => {
    render(show(done()));

    const log = screen.getByRole("status");
    expect(log).toContainElement(screen.getByText("Sent: “Reply with the single word OK”"));
    expect(log).toContainElement(screen.getByText("Answered: “OK” · 320 ms"));
    expect(screen.getByText("Answered: “OK” · 320 ms").closest(".mk-result")).not.toHaveClass("bad");
  });

  it("shows Answered alone when the reply is empty", () => {
    render(show(done({ reply: "" })));

    expect(screen.getByText("Answered · 320 ms")).toBeInTheDocument();
  });

  it("leaves the time out when it is not known, and shows 0 ms when it is zero", () => {
    const { rerender } = render(show(done({ tookMs: null })));
    expect(screen.getByText("Answered: “OK”")).toBeInTheDocument();

    rerender(show(done({ tookMs: 0 })));

    expect(screen.getByText("Answered: “OK” · 0 ms")).toBeInTheDocument();
  });

  it("leaves the Sent line out when no prompt came back", () => {
    render(show(done({ prompt: "" })));

    expect(screen.queryByText(/Sent:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Answered/)).toBeInTheDocument();
  });

  it("shows Not working with the reason in red, with the prompt and the time", () => {
    render(show(done({ working: false, reason: "the model refused the key", reply: "", tookMs: 85 })));

    const line = screen.getByText("Not working: the model refused the key · 85 ms");
    expect(line.closest(".mk-result")).toHaveClass("bad");
    expect(screen.getByText("Sent: “Reply with the single word OK”")).toBeInTheDocument();
    expect(screen.queryByText(/Answered/)).not.toBeInTheDocument();
  });

  it("shows Not working alone with the time left out when a refused test has neither prompt nor time", () => {
    render(show(done({ working: false, reason: "the AI backend did not answer", prompt: "", reply: "", tookMs: null })));

    expect(screen.getByText("Not working: the AI backend did not answer")).toBeInTheDocument();
    expect(screen.queryByText(/Sent:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ms$/)).not.toBeInTheDocument();
  });

  it("says the model did not answer when no reason came back", () => {
    render(show(done({ working: false, reason: "", reply: "", tookMs: null })));

    expect(screen.getByText(`Not working: ${words.en["models.noAnswer"]}`)).toBeInTheDocument();
  });

  it("shows a reply or reason exactly as it came, even with characters a replacement would read", () => {
    render(show(done({ reply: "costs $& and $1 {prompt}", prompt: "a $' b" })));

    expect(screen.getByText("Sent: “a $' b”")).toBeInTheDocument();
    expect(screen.getByText("Answered: “costs $& and $1 {prompt}” · 320 ms")).toBeInTheDocument();
  });

  it("speaks the chosen language", () => {
    localStorage.setItem("lang", "de");
    const { rerender } = render(show({ phase: "sending" }, "Claude"));
    expect(screen.getByText("Eine kurze Nachricht an Claude wird gesendet…")).toBeInTheDocument();

    rerender(show(done()));
    expect(screen.getByText("Gesendet: „Reply with the single word OK“")).toBeInTheDocument();
    expect(screen.getByText("Geantwortet: „OK“ · 320 ms")).toBeInTheDocument();

    rerender(show(done({ working: false, reason: "abgelehnt", reply: "" })));
    expect(screen.getByText("Funktioniert nicht: abgelehnt · 320 ms")).toBeInTheDocument();
  });
});

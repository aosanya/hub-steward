import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { emptyStep, type StepDraft } from "../../data/pages/workflowDesign";
import { I18nProvider, languages, type Language } from "../../i18n";
import { ChatStepCard } from "./ChatStepCard";

const words: Record<string, Record<string, string>> = JSON.parse(readFileSync(resolve(__dirname, "../../../public/i18n.json"), "utf8"));

const roles = [
  { value: "r1", label: "Farmers' agent" },
  { value: "r2", label: "Farmer" },
];

const chatStep = (more: Partial<StepDraft> = {}): StepDraft => ({
  ...emptyStep("chat"),
  name: "Chat with an agent",
  roleId: "r2",
  loaded: { id: "s1", kind: "chat", action: "Chats with an agent" },
  ...more,
});

const show = (step: StepDraft, lang: Language = "en") => {
  localStorage.setItem("lang", lang);
  return render(
    <I18nProvider initial={words}>
      <ChatStepCard number={1} step={step} roles={roles} />
    </I18nProvider>,
  );
};

describe("the card of a chat step", () => {
  it("names the role that opens it and says what the backend sent as the step's action", () => {
    show(chatStep({ loaded: { id: "s1", kind: "chat", action: "Opens a chat with an agent" } }));

    expect(screen.getByRole("heading", { name: "1 · Chat with an agent" })).toBeInTheDocument();
    expect(screen.getByText("Farmer · Opens a chat with an agent")).toBeInTheDocument();
  });

  it("names no actor when the step has no role, and not the agency", () => {
    const { container } = show(chatStep({ roleId: "" }));

    expect(container.querySelector(".muted")).toHaveTextContent(/^Chats with an agent$/);
    expect(screen.queryByText(/The agency/)).not.toBeInTheDocument();
  });

  it("names no actor when the role is not among the agency's roles", () => {
    show(chatStep({ roleId: "gone" }));

    expect(screen.getByText("Chats with an agent")).toBeInTheDocument();
    expect(screen.queryByText(/The agency/)).not.toBeInTheDocument();
  });

  it("says the sentence in the person's language when the backend sent no action", () => {
    for (const lang of languages) {
      const { unmount } = show(chatStep({ loaded: { id: "s1", kind: "chat" } }), lang);
      const sentence = words[lang]["workflows.chatAction"];

      expect(sentence, lang).toBeTruthy();
      if (lang !== "en") expect(sentence, lang).not.toBe(words.en["workflows.chatAction"]);
      expect(screen.getByText(`Farmer · ${sentence}`), lang).toBeInTheDocument();
      unmount();
    }
  });

  it("says the sentence alone when the step was never loaded and has no role", () => {
    show(chatStep({ roleId: "", loaded: undefined }), "de");

    expect(screen.getByText("Chattet mit einem Agenten")).toBeInTheDocument();
  });
});

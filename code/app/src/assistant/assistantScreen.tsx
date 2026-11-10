import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { routes } from "../routes";
import { AssistantPage } from "./AssistantPage";
import type { AssistantClient } from "./api";

export const showAssistant = (client: Partial<AssistantClient>) =>
  render(
    <MemoryRouter initialEntries={["/a/farmers/chat/assistant"]}>
      <Routes>
        <Route path={routes.assistant.pattern} element={<AssistantPage client={{ model: async () => "acc1", ask: async () => ({ text: "ok", lists: [] }), ...client }} />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  );

export const say = async (words: string) => {
  await userEvent.type(await screen.findByRole("textbox", { name: "Ask about the backlogs" }), words);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

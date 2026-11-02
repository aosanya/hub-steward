import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { hiddenPages } from "../data/menu";
import { callTool } from "../wakala/mcp";
import { PageView } from "./PageView";
import { answerTools, renderPage } from "./work/renderPage";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));

describe("a page held back from the menu", () => {
  it("shows its menu name and that the page is planned, with no table and no tool called", async () => {
    for (const page of hiddenPages) {
      answerTools({});
      const view = renderPage(`/h/h1/${page}`, <PageView />);

      expect(await screen.findByText("This page is planned.")).toBeInTheDocument();
      expect(screen.getByRole("heading")).not.toHaveTextContent("menu.");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(callTool).not.toHaveBeenCalled();
      view.unmount();
    }
  });
});

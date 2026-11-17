import { render, screen } from "@testing-library/react";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { MemoryRouter } from "react-router-dom";
import words from "../../public/i18n.json";
import { I18nProvider } from "../i18n";
import type { CalcStepApi } from "../pages/calcstep/calcStepApi";
import { fixtureChoice, fixtureFunctions, fixtureHeader } from "../pages/calcstep/calcStepFixture";
import { CalcStepPage } from "../pages/calcstep/CalcStepPage";

const api: CalcStepApi = {
  openStep: async () => fixtureHeader,
  listFunctions: async () => fixtureFunctions,
  chosenFunction: async () => fixtureChoice,
};

const styles = ["design.css", "ui/ui.css", "ui/notice.css", "ui/draftBar.css"].map((file) => readFileSync(resolve(__dirname, "..", file), "utf8")).join("\n");

const keepChoices = (root: HTMLElement) => {
  root.querySelectorAll("select").forEach((select) => {
    Array.from(select.options).forEach((option) => (option.selected ? option.setAttribute("selected", "") : option.removeAttribute("selected")));
  });
};

const savePage = (root: HTMLElement, folder: string, name: string) => {
  keepChoices(root);
  mkdirSync(folder, { recursive: true });
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${styles}</style></head><body><div data-theme="dark" style="padding:1.5rem;min-height:100vh;box-sizing:border-box;background:var(--bg)"><div style="max-width:60rem">${root.innerHTML}</div></div></body></html>`;
  writeFileSync(join(folder, name), page);
};

describe("a builder opens one step of a workflow and sees the function it calls", () => {
  it("reads the function with its version, the notice of a newer version and Save step", async () => {
    const { container } = render(
      <MemoryRouter>
        <I18nProvider initial={words}>
          <CalcStepPage hubId="h1" stepId="s1" api={api} onSave={() => undefined} />
        </I18nProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { level: 1, name: fixtureHeader.title })).toBeInTheDocument();
    expect(screen.getByText("Version in use: fin.pmt@2")).toBeInTheDocument();
    expect(screen.getByText("A newer version exists: fin.pmt@3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use version 3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save step" })).toBeInTheDocument();
    if (process.env.WALK_SHOTS) savePage(container, process.env.WALK_SHOTS, "function-card.html");
  });
});

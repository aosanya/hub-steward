import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import words from "../../public/i18n.json";
import { I18nProvider } from "../i18n";
import { savePage } from "./walkShot";
import type { CalcStepApi } from "../pages/calcstep/calcStepApi";
import { fixtureChoice, fixtureFunctions, fixtureHeader } from "../pages/calcstep/calcStepFixture";
import { CalcStepPage } from "../pages/calcstep/CalcStepPage";
import { actionItem } from "../ui/pageHeader.test-support";

const api: CalcStepApi = {
  openStep: async () => fixtureHeader,
  listFunctions: async () => fixtureFunctions,
  chosenFunction: async () => fixtureChoice,
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
    expect(await actionItem("Save step")).toBeInTheDocument();
    if (process.env.WALK_SHOTS) savePage(container, process.env.WALK_SHOTS, "function-card.html");
  });
});

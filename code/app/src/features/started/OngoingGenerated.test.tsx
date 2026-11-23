import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency } from "../../shared/wakala/openAgency";
import { magyar } from "../../shared/language/magyar";
import { swahili } from "../../shared/language/swahili";
import type { DoneClient, DoneItem, DonePage } from "./done";
import type { StartedClient } from "./api";
import { Ongoing } from "./Ongoing";

const sent: DoneItem = { id: "form-r1", workflow: "Form", title: "Report", state: "Sent", endedAt: "2026-10-21T12:00:00Z", path: "" };
const added: DoneItem = { id: "form-r5-add", workflow: "Add a tender", title: "Add a tender", state: "Added", endedAt: "2026-10-22T12:00:00Z", path: "" };

const page = (items: DoneItem[]): DonePage => ({ items, failed: [], next: null });

const clientOf = (items: DoneItem[]): DoneClient & { read: ReturnType<typeof vi.fn> } => ({ read: vi.fn(async () => page(items)) });

const live: StartedClient = { list: async () => [] };

const show = (plain: DoneClient, generated: DoneClient) =>
  render(
    <MemoryRouter>
      <Ongoing client={live} doneClient={plain} generatedDoneClient={generated} onStart={() => undefined} />
    </MemoryRouter>,
  );

const openDone = async () => userEvent.click(await screen.findByRole("button", { name: "Done" }));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  window.localStorage.clear();
});

describe("the Show generated switch of Ongoing", () => {
  it("is off to begin with, and Done reads the plain list", async () => {
    const plain = clientOf([sent]);
    const generated = clientOf([sent, added]);
    show(plain, generated);
    expect(await screen.findByRole("checkbox", { name: "Show generated" })).not.toBeChecked();
    await openDone();
    expect(await screen.findByText("Report")).toBeInTheDocument();
    expect(screen.queryByText("Add a tender")).not.toBeInTheDocument();
    expect(plain.read).toHaveBeenCalled();
    expect(generated.read).not.toHaveBeenCalled();
  });

  it("brings the generated runs into Done when it is switched on, and takes them out when it is switched off", async () => {
    show(clientOf([sent]), clientOf([sent, added]));
    await openDone();
    await screen.findByText("Report");
    await userEvent.click(screen.getByRole("checkbox", { name: "Show generated" }));
    expect(await screen.findByText("Add a tender")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Show generated" }));
    await screen.findByText("Report");
    expect(screen.queryByText("Add a tender")).not.toBeInTheDocument();
  });

  it("stays on the Done tab when it is switched", async () => {
    show(clientOf([sent]), clientOf([sent, added]));
    await openDone();
    await userEvent.click(await screen.findByRole("checkbox", { name: "Show generated" }));
    await screen.findByText("Add a tender");
    expect(screen.getByRole("button", { name: "Done" })).toHaveAttribute("aria-pressed", "true");
  });

  it("is said in the person's language", async () => {
    window.localStorage.setItem("hub.language", "sw");
    show(clientOf([]), clientOf([]));
    expect(await screen.findByRole("checkbox", { name: swahili.showGenerated })).toBeInTheDocument();
    cleanup();
    window.localStorage.setItem("hub.language", "hu");
    show(clientOf([]), clientOf([]));
    expect(await screen.findByRole("checkbox", { name: magyar.showGenerated })).toBeInTheDocument();
  });
});

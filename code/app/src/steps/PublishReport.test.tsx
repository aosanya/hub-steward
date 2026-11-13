import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublishReport } from "./PublishReport";
import { type PublishClient, type PublishedReport, type ReportFile } from "./publishApi";

const report: PublishedReport = { version: 1, gitPath: "reports/arrivals.pdf", publishedAt: "2026-11-13T09:30:00Z" };

const arrivals: ReportFile = { name: "arrivals.pdf", path: "reports/arrivals.pdf", version: "abc1234def5678", committedAt: "2026-11-13T09:30:00Z" };

const clientOf = (over: Partial<PublishClient> = {}): PublishClient => ({
  holds: vi.fn(async () => true),
  closedFormId: vi.fn(async () => "f1"),
  latest: vi.fn(async () => null),
  files: vi.fn(async () => [arrivals]),
  publish: vi.fn(async () => report),
  ...over,
});

const show = async (client: PublishClient) => {
  await act(async () => {
    render(<PublishReport formName="Arrival" client={client} />);
  });
};

const pick = async () => {
  await userEvent.click(screen.getByRole("button", { name: /arrivals\.pdf/ }));
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("a member holding report.publish can publish the closed form's report", () => {
  it("shows a Publish button, sends the tapped file and its version, then shows the version, file and date it went public", async () => {
    const client = clientOf();
    await show(client);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    await pick();
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(client.publish).toHaveBeenCalledWith("f1", "reports/arrivals.pdf", "abc1234def5678");
    expect(await screen.findByText(/Version 1/)).toBeInTheDocument();
    expect(screen.getByText(/reports\/arrivals\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/public since.*2026/)).toBeInTheDocument();
  });

  it("asks for the closed form of the step's form name", async () => {
    const client = clientOf();
    await show(client);
    expect(client.closedFormId).toHaveBeenCalledWith("Arrival");
  });

  it("keeps Publish disabled until a file is tapped", async () => {
    await show(clientOf());
    const button = screen.getByRole("button", { name: "Publish" });
    expect(button).toBeDisabled();
    await pick();
    expect(button).toBeEnabled();
  });

  it("says in plain words when the report could not be published", async () => {
    const client = clientOf({ publish: vi.fn(async () => Promise.reject(new Error("boom"))) });
    await show(client);
    await pick();
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("The report could not be published. Try again.")).toBeInTheDocument();
  });
});

describe("a member without report.publish sees nothing", () => {
  it("shows no Publish button and never publishes", async () => {
    const client = clientOf({ holds: vi.fn(async () => false) });
    await show(client);
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(client.publish).not.toHaveBeenCalled();
  });
});

describe("a holder whose form is not closed", () => {
  it("shows no Publish button", async () => {
    await show(clientOf({ closedFormId: vi.fn(async () => null) }));
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });
});

describe("a report already published", () => {
  it("shows its file, version and date before anything is pressed", async () => {
    await show(clientOf({ latest: vi.fn(async () => report) }));
    expect(screen.getByText(/Version 1/)).toBeInTheDocument();
    expect(screen.getByText(/reports\/arrivals\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/public since.*2026/)).toBeInTheDocument();
  });
});

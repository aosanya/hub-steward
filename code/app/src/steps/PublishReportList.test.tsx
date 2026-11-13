import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublishReport } from "./PublishReport";
import { type PublishClient, type PublishedReport, type ReportFile } from "./publishApi";

const report: PublishedReport = { version: 1, gitPath: "reports/arrivals-final.pdf", publishedAt: "2026-11-13T09:30:00Z" };

const newest: ReportFile = { name: "arrivals-final.pdf", path: "reports/arrivals-final.pdf", version: "abc1234def5678", committedAt: "2026-11-13T09:30:00Z" };
const older: ReportFile = { name: "arrivals-draft.pdf", path: "reports/arrivals-draft.pdf", version: "9876543fedcba", committedAt: "2026-11-12T08:00:00Z" };

const clientOf = (over: Partial<PublishClient> = {}): PublishClient => ({
  holds: vi.fn(async () => true),
  closedFormId: vi.fn(async () => "f1"),
  latest: vi.fn(async () => null),
  files: vi.fn(async () => [newest, older]),
  publish: vi.fn(async () => report),
  ...over,
});

const show = async (client: PublishClient) => {
  await act(async () => {
    render(<PublishReport formName="Arrival" client={client} />);
  });
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the Mayor picks the report file and version from a list", () => {
  it("lists each stored file with its name and the first seven characters of its version, newest first as given", async () => {
    await show(clientOf());
    const entries = screen.getAllByRole("button", { pressed: false });
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent("arrivals-final.pdf");
    expect(entries[0]).toHaveTextContent("abc1234");
    expect(entries[0]).not.toHaveTextContent("abc1234def");
    expect(entries[1]).toHaveTextContent("arrivals-draft.pdf");
    expect(entries[1]).toHaveTextContent("9876543");
    expect(entries[1]).not.toHaveTextContent("9876543f");
  });

  it("shows the date each version was committed", async () => {
    await show(clientOf());
    expect(screen.getAllByRole("button", { pressed: false })[0]).toHaveTextContent(/2026/);
  });

  it("asks for the files of the closed form", async () => {
    const client = clientOf();
    await show(client);
    expect(client.files).toHaveBeenCalledWith("f1");
  });

  it("shows no typed Report file or Version box", async () => {
    await show(clientOf());
    expect(screen.queryByLabelText("Report file")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Version")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("keeps Publish disabled until an entry is tapped", async () => {
    await show(clientOf());
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /arrivals-draft\.pdf/ }));
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
  });

  it("marks the tapped entry as selected and no other", async () => {
    await show(clientOf());
    await userEvent.click(screen.getByRole("button", { name: /arrivals-draft\.pdf/ }));
    expect(screen.getByRole("button", { name: /arrivals-draft\.pdf/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /arrivals-final\.pdf/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("moves the selection when another entry is tapped", async () => {
    await show(clientOf());
    await userEvent.click(screen.getByRole("button", { name: /arrivals-draft\.pdf/ }));
    await userEvent.click(screen.getByRole("button", { name: /arrivals-final\.pdf/ }));
    expect(screen.getByRole("button", { name: /arrivals-final\.pdf/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /arrivals-draft\.pdf/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("publishes the tapped entry's path with its full version", async () => {
    const client = clientOf();
    await show(client);
    await userEvent.click(screen.getByRole("button", { name: /arrivals-draft\.pdf/ }));
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(client.publish).toHaveBeenCalledWith("f1", "reports/arrivals-draft.pdf", "9876543fedcba");
    expect(client.publish).toHaveBeenCalledTimes(1);
  });

  it("shows the published version after Publish", async () => {
    await show(clientOf());
    await userEvent.click(screen.getByRole("button", { name: /arrivals-final\.pdf/ }));
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText(/Version 1/)).toBeInTheDocument();
  });

  it("says in plain words when the report could not be published", async () => {
    const client = clientOf({ publish: vi.fn(async () => Promise.reject(new Error("boom"))) });
    await show(client);
    await userEvent.click(screen.getByRole("button", { name: /arrivals-final\.pdf/ }));
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("The report could not be published. Try again.")).toBeInTheDocument();
  });
});

describe("a closed form with no stored report file", () => {
  it("says so in one sentence and shows no Publish button", async () => {
    await show(clientOf({ files: vi.fn(async () => []) }));
    expect(screen.getByText("No report file is stored for this step yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { pressed: false })).not.toBeInTheDocument();
  });
});

describe("a member without report.publish sees nothing", () => {
  it("renders nothing and never asks for the files", async () => {
    const client = clientOf({ holds: vi.fn(async () => false) });
    await show(client);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("No report file is stored for this step yet.")).not.toBeInTheDocument();
    expect(client.files).not.toHaveBeenCalled();
    expect(client.publish).not.toHaveBeenCalled();
  });
});

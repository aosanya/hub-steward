import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agentOne, backText, barTitle, folder, goBack, prepare, release, show, where } from "./filesFixture";

vi.mock("./viewer/FileViewer", () => ({
  FileViewer: (props: { name: string; text: string | null; reason?: string }) => (
    <div data-testid="viewer">
      {props.name}|{props.text ?? ""}|{props.reason ?? ""}
    </div>
  ),
}));

beforeEach(() => prepare(false));

afterEach(() => {
  cleanup();
  release();
});

const changes = { "r1:main.go": agentOne, "r1:docs/a.md": agentOne };

describe("a file's screen on a phone", () => {
  it("is titled with the file's name, with Back naming the Folder it is in", async () => {
    show("/a/hub-1/files/r1/file?path=main.go", { changes });
    await screen.findByTestId("viewer");
    expect(barTitle()).toBe("main.go");
    expect(backText()).toContain("Field notes");
    goBack();
    expect(where()).toBe("/a/hub-1/files/r1");
  });

  it("says under the name when and by whom the file changed", async () => {
    const client = show("/a/hub-1/files/r1/file?path=main.go", { changes });
    expect(await screen.findByText("Changed 2 hours ago by Agent One")).toBeInTheDocument();
    expect(client.changed).toHaveBeenCalledWith(folder, "main.go");
  });

  it("leaves the Changed line off when the file has no answer", async () => {
    show("/a/hub-1/files/r1/file?path=main.go");
    await screen.findByTestId("viewer");
    expect(screen.queryByText(/^Changed/)).toBeNull();
  });

  it("hands the file's name and text to the viewer", async () => {
    const client = show("/a/hub-1/files/r1/file?path=main.go");
    expect(await screen.findByTestId("viewer")).toHaveTextContent("main.go|package main|");
    expect(client.read).toHaveBeenCalledWith(folder, "main.go");
  });

  it("hands a file the app will not show to the viewer with no text and its reason", async () => {
    show("/a/hub-1/files/r1/file?path=big.bin", { answers: { "big.bin": { status: "withheld", name: "big.bin", path: "big.bin", size: 2000000, reason: "too large" } } });
    expect(await screen.findByTestId("viewer")).toHaveTextContent("big.bin||too large");
  });

  it("has a file inside a folder name that folder in Back and lead to it", async () => {
    show("/a/hub-1/files/r1/file?path=docs%2Fa.md", { changes });
    expect(await screen.findByTestId("viewer")).toHaveTextContent("a.md|# Alpha|");
    expect(barTitle()).toBe("a.md");
    expect(backText()).toContain("docs");
    goBack();
    expect(where()).toBe("/a/hub-1/files/r1?path=docs");
  });

  it("says a file that is not there was not found", async () => {
    show("/a/hub-1/files/r1/file?path=gone.txt");
    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
    expect(screen.queryByTestId("viewer")).toBeNull();
  });

  it("says in plain words that the file could not be loaded, with Try again", async () => {
    show("/a/hub-1/files/r1/file?path=main.go", { readFail: true });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/repositor|branch|commit|diff|merge/i);
  });

  it("shows no tree, no tab strip and no Properties, and keeps the bottom bar", async () => {
    show("/a/hub-1/files/r1/file?path=main.go");
    await screen.findByTestId("viewer");
    expect(screen.queryByRole("tree")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Properties" })).toBeNull();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });
});

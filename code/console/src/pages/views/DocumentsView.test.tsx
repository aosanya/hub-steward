import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answerWith, callsOf, proposals, renderPage } from "../spec/profileTesting";
import { DocumentsView } from "./DocumentsView";

vi.mock("../../wakala/mcp");

const sources = [
  { id: "s1", title: "Wi-Fi guide", updated_at: "2026-10-21T12:00:00Z", properties: { languages: ["en", "sw", "de"] } },
  { id: "s2", title: "Booking rules", updated_at: "2026-10-20T12:00:00Z", properties: { language: "en" } },
  { id: "s3", title: "Opening hours", updated_at: "2026-10-19T12:00:00Z", properties: {} },
];

const chunks = (args: Record<string, unknown>) => ({ s1: [{}, {}, {}, {}, {}], s2: [{}, {}], s3: [{}] })[String(args.sourceID)];

const open = async (replies: Record<string, unknown> = {}) => {
  answerWith({
    sources_source_list: sources,
    sources_chunk_list: chunks,
    instance_get_join_mode: { join_mode: "open" },
    instance_get_languages: { default: "en", languages: [{ code: "en" }, { code: "sw" }] },
    agency_propose_write: { status: "pending" },
    ...replies,
  });
  renderPage(<DocumentsView />, "documents");
  await screen.findByRole("button", { name: "Wi-Fi guide" });
};

const titles = () => screen.queryAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);

const cardsOf = async () => {
  const user = userEvent.setup();
  for (const button of document.querySelectorAll<HTMLElement>(".card-toggle")) await user.click(button);
  return [...document.querySelectorAll(".card")].map((card) => [card.querySelector("h2")?.textContent, ...[...card.querySelectorAll("dd")].map((value) => value.textContent)]);
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the documents page", () => {
  it("shows one line per document with its languages, its passages and when it was updated", async () => {
    await open();

    expect(screen.getByRole("heading", { name: "Documents", level: 1 })).toBeInTheDocument();
    expect(await cardsOf()).toEqual([
      ["Booking rules", "EN", "2", "20 Oct"],
      ["Opening hours", "—", "1", "19 Oct"],
      ["Wi-Fi guide", "DE · EN · SW", "5", "21 Oct"],
    ]);
  });

  it("lists the documents by title", async () => {
    await open();

    expect(titles()).toEqual(["Booking rules", "Opening hours", "Wi-Fi guide"]);
  });

  it("offers Upload a document in the title row and a search and a language filter above the cards", async () => {
    await open();

    expect(screen.getByRole("button", { name: "Upload a document" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search documents" })).toBeInTheDocument();
    const options = [...screen.getByRole("combobox", { name: "All languages" }).querySelectorAll("option")].map((option) => [
      option.value,
      option.textContent,
    ]);
    expect(options).toEqual([
      ["", "All languages"],
      ["de", "Deutsch"],
      ["en", "English"],
      ["sw", "Kiswahili"],
    ]);
  });

  it("narrows the lines to the documents whose title has the words typed", async () => {
    const user = userEvent.setup();
    await open();

    await user.type(screen.getByRole("searchbox", { name: "Search documents" }), "rules");

    expect(titles()).toEqual(["Booking rules"]);
  });

  it("narrows the lines to the documents in the language chosen", async () => {
    const user = userEvent.setup();
    await open();

    await user.selectOptions(screen.getByRole("combobox", { name: "All languages" }), "sw");

    expect(titles()).toEqual(["Wi-Fi guide"]);
  });

  it("says there is nothing here when the words typed match no document", async () => {
    const user = userEvent.setup();
    await open();

    await user.type(screen.getByRole("searchbox", { name: "Search documents" }), "zebra");

    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
    expect(titles()).toEqual([]);
  });

  it("reads the list of documents once and the passages of each document", async () => {
    await open();

    expect(callsOf("sources_source_list")).toHaveLength(1);
    expect(callsOf("sources_chunk_list")).toHaveLength(3);
  });
});

describe("a hub with no documents", () => {
  it("says there are no documents yet and puts the upload button inside, not in the title row", async () => {
    answerWith({ sources_source_list: [] });
    renderPage(<DocumentsView />, "documents");

    const empty = await screen.findByText("No documents yet.");

    expect(within(empty.parentElement as HTMLElement).getByRole("button", { name: "Upload a document" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Upload a document" })).toHaveLength(1);
  });
});

describe("a list that cannot be loaded", () => {
  it("says the page could not be loaded in the error style and keeps the title", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("offline"));
    renderPage(<DocumentsView />, "documents");

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
    expect(screen.getByRole("heading", { name: "Documents", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload a document" })).not.toBeInTheDocument();
  });
});

describe("uploading a document", () => {
  const openForm = async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole("button", { name: "Upload a document" }));
    await screen.findByRole("form", { name: "Upload a document" });
    return user;
  };

  it("opens a form titled Upload a document with the file, title, language and text fields and the note", async () => {
    await openForm();

    expect(screen.getByRole("heading", { name: "Upload a document", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("File")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Text" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit for approval" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByText("Pending approval. Nothing is recorded until you approve.")).toBeInTheDocument();
  });

  it("offers the languages of the hub and starts with the first", async () => {
    await openForm();

    await waitFor(() => expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("en"));
    const options = [...screen.getByRole("combobox", { name: "Language" }).querySelectorAll("option")].map((option) => option.value);
    expect(options).toEqual(["en", "sw"]);
  });

  it("asks for approval to add the document, says it waits for approval and returns to the list", async () => {
    const user = await openForm();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("en"));
    await user.type(screen.getByRole("textbox", { name: "Title" }), "Seed guide");
    await user.selectOptions(screen.getByRole("combobox", { name: "Language" }), "sw");
    await user.type(screen.getByRole("textbox", { name: "Text" }), "Plant after the rains.");

    await user.click(screen.getByRole("button", { name: "Submit for approval" }));

    const note = await screen.findByText("Waiting for approval");
    expect(note).toHaveAttribute("role", "status");
    expect(screen.queryByRole("form", { name: "Upload a document" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wi-Fi guide" })).toBeInTheDocument();
    expect(proposals()).toEqual([
      {
        kind: "sources_document_create",
        summary: "Add the document Seed guide",
        payload: { title: "Seed guide", language: "sw", text: "Plant after the rains." },
      },
    ]);
  });

  it("asks for the title and the text and sends nothing when they are missing", async () => {
    const user = await openForm();

    await user.click(screen.getByRole("button", { name: "Submit for approval" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Required: Title, Text");
    expect(callsOf("agency_propose_write")).toEqual([]);
  });

  it("fills the title and the text from the file chosen", async () => {
    const user = await openForm();
    const file = new File(["Wi-Fi is free."], "wifi-guide.md", { type: "text/markdown" });

    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Text" })).toHaveValue("Wi-Fi is free."));
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("wifi-guide");
    expect(screen.getByText("wifi-guide.md")).toBeInTheDocument();
  });

  it("keeps a title that was typed when a file is chosen", async () => {
    const user = await openForm();
    await user.type(screen.getByRole("textbox", { name: "Title" }), "Guide");

    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, new File(["x"], "other.md"));

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Text" })).toHaveValue("x"));
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Guide");
  });

  it("says the change could not be sent and keeps the form and what was typed when the proposal fails", async () => {
    const user = userEvent.setup();
    await open({
      agency_propose_write: () => {
        throw new Error("offline");
      },
    });
    await user.click(screen.getByRole("button", { name: "Upload a document" }));
    await user.type(await screen.findByRole("textbox", { name: "Title" }), "Seed guide");
    await user.type(screen.getByRole("textbox", { name: "Text" }), "Plant.");

    await user.click(screen.getByRole("button", { name: "Submit for approval" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The change could not be sent.");
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Seed guide");
  });

  it("returns to the list without sending anything when cancelled", async () => {
    const user = await openForm();
    await user.type(screen.getByRole("textbox", { name: "Title" }), "Seed guide");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("form", { name: "Upload a document" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Wi-Fi guide" })).toBeInTheDocument();
    expect(callsOf("agency_propose_write")).toEqual([]);
  });
});

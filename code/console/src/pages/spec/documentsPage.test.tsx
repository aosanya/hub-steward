import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentsList } from "./documentsList";
import { UploadForm, readText } from "./documentsUpload";
import { answering, clearPages, failing, installPage, renderSpec } from "./specHarness.test-helper";

vi.mock("../../data/registry", () => import("./fakeRegistry"));

const rows = [
  { document: "Constitution", languages: "en, hu", passages: "14", updated: "2026-10-05T09:00:00Z" },
  { document: "Bylaws", languages: "en", passages: "6", updated: "2026-11-01T09:00:00Z" },
  { document: "Seed charter", languages: "", passages: "2", updated: "not a date" },
];

const quiet = { text: "", failed: false };

beforeEach(() => {
  clearPages();
});

describe("the documents list", () => {
  it("lists the documents by title with a button to upload one", () => {
    renderSpec(<DocumentsList rows={rows} note={quiet} onUpload={() => {}} />);

    const titles = screen.getAllByRole("heading").map((node) => node.textContent);
    expect(titles.indexOf("Bylaws")).toBeLessThan(titles.indexOf("Constitution"));
    expect(screen.getByRole("button", { name: "Upload a document" })).toBeInTheDocument();
  });

  it("asks to upload when the button is pressed", async () => {
    const upload = vi.fn();
    renderSpec(<DocumentsList rows={rows} note={quiet} onUpload={upload} />);

    await userEvent.click(screen.getByRole("button", { name: "Upload a document" }));

    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("shows the languages in capitals, the passages and the date once a document is opened", async () => {
    renderSpec(<DocumentsList rows={rows} note={quiet} onUpload={() => {}} />);

    await userEvent.click(screen.getByText("Constitution"));

    expect(screen.getByText("EN · HU")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("5 Oct")).toBeInTheDocument();
  });

  it("shows a dash for a document with no language and the text of a date it cannot read", async () => {
    renderSpec(<DocumentsList rows={rows} note={quiet} onUpload={() => {}} />);

    await userEvent.click(screen.getByText("Seed charter"));

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText("not a date")).toBeInTheDocument();
  });

  it("narrows the documents to the search words", async () => {
    renderSpec(<DocumentsList rows={rows} note={quiet} onUpload={() => {}} />);

    await userEvent.type(screen.getByPlaceholderText("Search documents"), "bylaw");

    expect(screen.getByText("Bylaws")).toBeInTheDocument();
    expect(screen.queryByText("Constitution")).not.toBeInTheDocument();
  });

  it("narrows the documents to one language, offering only languages a document has", async () => {
    renderSpec(<DocumentsList rows={rows} note={quiet} onUpload={() => {}} />);

    const select = screen.getByRole("combobox");
    expect(Array.from((select as HTMLSelectElement).options).map((option) => option.value)).toEqual(["", "en", "hu"]);
    await userEvent.selectOptions(select, "hu");

    expect(screen.getByText("Constitution")).toBeInTheDocument();
    expect(screen.queryByText("Bylaws")).not.toBeInTheDocument();
  });

  it("says nothing matches when the filter leaves no document", async () => {
    renderSpec(<DocumentsList rows={rows} note={quiet} onUpload={() => {}} />);

    await userEvent.type(screen.getByPlaceholderText("Search documents"), "zzz");

    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("offers the upload inside the empty card, and not in the title bar, when the hub has no document", async () => {
    const upload = vi.fn();
    renderSpec(<DocumentsList rows={[]} note={quiet} onUpload={upload} />);

    expect(screen.getByText("No documents yet.")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Upload a document" });
    expect(buttons).toHaveLength(1);
    await userEvent.click(buttons[0]);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("says the page could not be loaded, with no upload button, when the rows are refused", () => {
    renderSpec(<DocumentsList rows={null} note={quiet} onUpload={() => {}} />);

    expect(screen.getByText("The page could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload a document" })).not.toBeInTheDocument();
  });

  it("shows the note a change left behind", () => {
    renderSpec(<DocumentsList rows={rows} note={{ text: "Waiting for approval", failed: false }} onUpload={() => {}} />);

    expect(screen.getByText("Waiting for approval")).toBeInTheDocument();
  });
});

const languagePage = { rows: [{ default_language: "en", languages: ["en", "hu"] }] };

const charter = (name = "charter.txt", body = "Seeds are shared.") => new File([body], name, { type: "text/plain" });

const fileInput = () => globalThis.document.querySelector("input[type=file]") as HTMLInputElement;

const form = async (actions?: Parameters<typeof installPage>[1]["actions"]) => {
  installPage("general", languagePage);
  installPage("documents", { actions });
  const outcome = vi.fn();
  const cancel = vi.fn();
  renderSpec(<UploadForm hubId="h1" onOutcome={outcome} onCancel={cancel} />);
  await screen.findByRole("option", { name: "English" });
  return { outcome, cancel };
};

describe("uploading a document", () => {
  it("reads the file's text", async () => {
    expect(await readText(charter("a.txt", "hello"))).toBe("hello");
  });

  it("offers the hub's languages by their own names, the first chosen", async () => {
    await form();

    const select = screen.getByLabelText("Language") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(["English", "Magyar"]);
    expect(select.value).toBe("en");
  });

  it("fills the title from the file's name and the text from its contents", async () => {
    await form();

    await userEvent.upload(fileInput(), charter());

    await waitFor(() => expect(screen.getByLabelText("Text")).toHaveValue("Seeds are shared."));
    expect(screen.getByLabelText("Title")).toHaveValue("charter");
  });

  it("keeps a title already typed when a file is chosen", async () => {
    await form();

    await userEvent.type(screen.getByLabelText("Title"), "Our charter");
    await userEvent.upload(fileInput(), charter());

    await waitFor(() => expect(screen.getByLabelText("Text")).toHaveValue("Seeds are shared."));
    expect(screen.getByLabelText("Title")).toHaveValue("Our charter");
  });

  it("names what is missing and sends nothing", async () => {
    const documents = answering("accepted");
    await form({ documents });

    await userEvent.click(screen.getByRole("button", { name: "Submit for approval" }));

    expect(await screen.findByText("Required: Title, Text")).toBeInTheDocument();
    expect(documents).not.toHaveBeenCalled();
  });

  it("sends the title, language and text, and reports what the hub answered", async () => {
    const documents = answering("accepted");
    const { outcome } = await form({ documents });

    await userEvent.upload(fileInput(), charter());
    await waitFor(() => expect(screen.getByLabelText("Text")).toHaveValue("Seeds are shared."));
    await userEvent.selectOptions(screen.getByLabelText("Language"), "hu");
    await userEvent.click(screen.getByRole("button", { name: "Submit for approval" }));

    await waitFor(() => expect(documents).toHaveBeenCalledWith("h1", { title: "charter", language: "hu", text: "Seeds are shared." }));
    await waitFor(() => expect(outcome).toHaveBeenCalledWith("accepted"));
  });

  it("shows the failure line and does not report an outcome when the hub refuses", async () => {
    const { outcome } = await form({ documents: failing() });

    await userEvent.type(screen.getByLabelText("Title"), "Charter");
    await userEvent.type(screen.getByLabelText("Text"), "Seeds");
    await userEvent.click(screen.getByRole("button", { name: "Submit for approval" }));

    expect(await screen.findByText("The change could not be sent.")).toBeInTheDocument();
    expect(outcome).not.toHaveBeenCalled();
  });

  it("closes on Cancel without sending", async () => {
    const documents = answering("done");
    const { cancel } = await form({ documents });

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(documents).not.toHaveBeenCalled();
  });
});

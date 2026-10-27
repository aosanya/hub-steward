import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { documentsPage } from "./documents";

vi.mock("../../wakala/mcp");

const sources = {
  items: [
    { id: "s1", title: "Wi-Fi guide", updated_at: "2026-10-01T10:00:00Z", properties: { language: "en" } },
    { id: "s2", title: "Wi-Fi guide", updated_at: "2026-10-05T10:00:00Z", properties: { language: "sw" } },
    { id: "s3", title: "Seed-saving guide", updated_at: "2026-09-20T10:00:00Z", properties: { languages: ["de"] } },
  ],
};

const chunksOf: Record<string, unknown> = {
  s1: { items: [{ text: "a" }, { text: "b" }] },
  s2: { items: [{ text: "c" }] },
  s3: [{ text: "d" }, { text: "e" }, { text: "f" }],
};

const answerWithSources = (list: unknown = sources, chunks: Record<string, unknown> = chunksOf) =>
  vi.mocked(callTool).mockImplementation(async (_hubId, tool, args) => {
    if (tool === "sources_source_list") return list as never;
    if (tool === "sources_chunk_list") return chunks[String(args?.sourceID)] as never;
    throw new Error("unexpected tool " + tool);
  });

const toolsCalled = () => vi.mocked(callTool).mock.calls.map((call) => call[1]);

const proposal = () => {
  const args = vi.mocked(callTool).mock.calls.find((call) => call[1] === "agency_propose_write")?.[2] as {
    kind: string;
    summary: string;
    payload: string;
  };
  return { kind: args.kind, summary: args.summary, payload: JSON.parse(args.payload) };
};

const upload = (values: Record<string, unknown>) => documentsPage.actions!.documents("h1", values);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the documents page", () => {
  it("offers Upload a document and lists the tools it reads and the one it proposes", () => {
    expect(documentsPage.spec.id).toBe("documents");
    expect(documentsPage.spec.title).toBe("Documents");
    expect(documentsPage.spec.primary).toBe("Upload a document");
    expect(documentsPage.spec.tools).toEqual(["sources_source_list", "sources_chunk_list", "sources_document_create"]);
    expect(documentsPage.spec.columns).toEqual([
      { key: "document", label: "Document" },
      { key: "languages", label: "Languages" },
      { key: "passages", label: "Passages" },
      { key: "updated", label: "Updated" },
    ]);
  });

  it("shows one row per title, joining its translations and adding up their passages", async () => {
    answerWithSources();

    const rows = await documentsPage.rows("h1", {});

    expect(rows).toEqual([
      { document: "Wi-Fi guide", languages: "en, sw", passages: 3, updated: "2026-10-05T10:00:00Z" },
      { document: "Seed-saving guide", languages: "de", passages: 3, updated: "2026-09-20T10:00:00Z" },
    ]);
  });

  it("counts the passages of every source by asking for its chunks", async () => {
    answerWithSources();

    await documentsPage.rows("h1", {});

    const asked = vi.mocked(callTool).mock.calls.filter((call) => call[1] === "sources_chunk_list").map((call) => call[2]);
    expect(asked).toEqual([{ sourceID: "s1" }, { sourceID: "s2" }, { sourceID: "s3" }]);
    expect(toolsCalled()[0]).toBe("sources_source_list");
  });

  it("narrows the rows by a search on the title, ignoring case", async () => {
    answerWithSources();

    const rows = await documentsPage.rows("h1", { search: "SEED" });

    expect(rows.map((row) => row.document)).toEqual(["Seed-saving guide"]);
  });

  it("narrows the rows by a language", async () => {
    answerWithSources();

    const rows = await documentsPage.rows("h1", { language: "sw" });

    expect(rows.map((row) => row.document)).toEqual(["Wi-Fi guide"]);
  });

  it("shows no rows when the search and the language match different documents", async () => {
    answerWithSources();

    expect(await documentsPage.rows("h1", { search: "wi-fi", language: "de" })).toEqual([]);
  });

  it("ignores a search or language made only of spaces", async () => {
    answerWithSources();

    expect(await documentsPage.rows("h1", { search: "  ", language: " " })).toHaveLength(2);
  });

  it("reads the languages of a source from its languages list before its single language", async () => {
    answerWithSources(
      [{ id: "s1", title: "Both", updated_at: "", properties: { languages: ["fr", "", 3, "de"], language: "en" } }],
      { s1: [] },
    );

    const rows = await documentsPage.rows("h1", {});

    expect(rows).toEqual([{ document: "Both", languages: "de, fr", passages: 0, updated: "" }]);
  });

  it("shows an empty language cell for a source with no language", async () => {
    answerWithSources([{ id: "s1", title: "Plain" }], { s1: {} });

    expect(await documentsPage.rows("h1", {})).toEqual([{ document: "Plain", languages: "", passages: 0, updated: "" }]);
  });

  it("shows no rows when there are no sources", async () => {
    answerWithSources({ items: [] });

    expect(await documentsPage.rows("h1", {})).toEqual([]);
    expect(toolsCalled()).toEqual(["sources_source_list"]);
  });

  it("shows no rows when the source list is not a list", async () => {
    answerWithSources({ unexpected: true });

    expect(await documentsPage.rows("h1", {})).toEqual([]);
  });

  it("fails the page when the source list fails", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("boom"));

    await expect(documentsPage.rows("h1", {})).rejects.toThrow("boom");
  });

  it("fails the page when a chunk list fails", async () => {
    vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
      if (tool === "sources_source_list") return sources as never;
      throw new Error("sources_chunk_list: boom");
    });

    await expect(documentsPage.rows("h1", {})).rejects.toThrow("boom");
  });
});

describe("uploading a document", () => {
  it("asks for approval to add the document and never creates it directly", async () => {
    vi.mocked(callTool).mockResolvedValue({ status: "pending" } as never);

    const result = await upload({ title: " Wi-Fi guide ", language: " en ", text: " Ask at the desk. " });

    expect(result).toBe("accepted");
    expect(toolsCalled()).toEqual(["agency_propose_write"]);
    expect(proposal()).toEqual({
      kind: "sources_document_create",
      summary: "Add the document Wi-Fi guide",
      payload: { title: "Wi-Fi guide", language: "en", text: "Ask at the desk." },
    });
  });

  it("sends an empty language when none was typed", async () => {
    vi.mocked(callTool).mockResolvedValue({} as never);

    await upload({ title: "A", text: "b" });

    expect(proposal().payload).toEqual({ title: "A", language: "", text: "b" });
  });

  it("refuses a missing title or a missing text without calling anything", async () => {
    await expect(upload({ title: "  ", text: "x" })).rejects.toThrow("title is required");
    await expect(upload({ title: "A", text: "  " })).rejects.toThrow("text is required");
    await expect(upload({})).rejects.toThrow("title is required");

    expect(callTool).not.toHaveBeenCalled();
  });

  it("fails when the approval request fails", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("boom"));

    await expect(upload({ title: "A", text: "b" })).rejects.toThrow("boom");
  });
});

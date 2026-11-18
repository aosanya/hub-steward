import { textPdf } from "./textPdf";

const read = (bytes: Uint8Array) => Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");

describe("a text PDF", () => {
  it("starts as a PDF, ends with %%EOF and carries the title and the lines", () => {
    const body = read(textPdf("First quarter", ["Planned: 8,000 Ft", "Spent: 8,300 Ft"]));
    expect(body.startsWith("%PDF-1.4")).toBe(true);
    expect(body.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(body).toContain("(First quarter)");
    expect(body).toContain("(Planned: 8,000 Ft)");
  });

  it("escapes brackets and backslashes in the text", () => {
    const body = read(textPdf("A (b) c\\d", []));
    expect(body).toContain("(A \\(b\\) c\\\\d)");
  });

  it("writes the right byte offsets into its cross-reference table", () => {
    const body = read(textPdf("Offsets", ["one", "two"]));
    const table = body.slice(body.indexOf("xref"));
    const offsets = [...table.matchAll(/(\d{10}) 00000 n/g)].map((match) => Number(match[1]));
    expect(offsets.length).toBeGreaterThan(3);
    offsets.forEach((offset, index) => expect(body.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true));
    expect(Number(/startxref\n(\d+)/.exec(body)?.[1])).toBe(body.indexOf("xref"));
  });

  it("keeps Latin-1 letters and maps ő and ű to their nearest Latin-1 letters instead of breaking", () => {
    const bytes = textPdf("Fő utca, Győr, Szűcs, Kőhíd", []);
    const body = read(bytes);
    expect(body).toContain("(F\xF6 utca, Gy\xF6r, Sz\xFCcs, K\xF6h\xEDd)");
  });

  it("starts a new page when the lines run past one page", () => {
    const lines = Array.from({ length: 120 }, (_, index) => `Row ${index}`);
    const body = read(textPdf("Long", lines));
    expect((body.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
  });
});

import { reportPdf } from "./reportPdf";
import { pdfTextOf } from "./pdfTestKit";

const header = (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 8));

describe("a report PDF with an embedded font", () => {
  it("starts as a PDF", async () => {
    const bytes = await reportPdf("First quarter", ["Planned: 8,000 Ft"]);
    expect(header(bytes).startsWith("%PDF-")).toBe(true);
  });

  it("prints ő and ű as themselves, not as ö and ü", async () => {
    const shown = await pdfTextOf(await reportPdf("Fő utca", ["Szűcs Kőhíd", "Győr, Ő és Ű"]));
    expect(shown).toContain("Fő utca");
    expect(shown).toContain("Szűcs Kőhíd");
    expect(shown).toContain("Győr, Ő és Ű");
    expect(shown).not.toMatch(/[öü]/);
  });

  it("carries the figures, the dash between a name and its meta and a euro sign", async () => {
    const shown = await pdfTextOf(await reportPdf("Q2", ["Planned: 8,000 Ft", "Road repair – Planned 7,000 · Spent 5,000", "Total €1,000"]));
    expect(shown).toContain("Planned: 8,000 Ft");
    expect(shown).toContain("Road repair – Planned 7,000 · Spent 5,000");
    expect(shown).toContain("Total €1,000");
  });

  it("draws a letter the font lacks as a question mark and still makes a PDF", async () => {
    const shown = await pdfTextOf(await reportPdf("Q2", ["Name 世界"]));
    expect(shown).toContain("Name ??");
  });

  it("starts a new page when the lines run past one page", async () => {
    const lines = Array.from({ length: 120 }, (_, index) => `Row ${index}`);
    const shown = await pdfTextOf(await reportPdf("Long", lines));
    expect(shown).toContain("Row 0");
    expect(shown).toContain("Row 119");
  });

  it("wraps a long line instead of running off the page", async () => {
    const long = Array.from({ length: 40 }, () => "Közlekedési").join(" ");
    const shown = await pdfTextOf(await reportPdf("Wrap", [long]));
    expect(shown.split("\n").filter((row) => row.includes("Közlekedési")).length).toBeGreaterThan(1);
  });
});

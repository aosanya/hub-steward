import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont } from "pdf-lib";
import { notoBold } from "./reportFonts/notoSansBold";
import { notoRegular } from "./reportFonts/notoSansRegular";

const pageWidth = 595;
const pageHeight = 842;
const margin = 50;
const titleSize = 16;
const bodySize = 11;
const leading = 16;
const titleGap = 30;

const bytesOfBase64 = (encoded: string) => Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));

const known = (font: PDFFont, char: string) => font.getCharacterSet().includes(char.codePointAt(0) ?? 0);

const printable = (font: PDFFont, value: string) => Array.from(value.replace(/\s/g, " "), (char) => (known(font, char) ? char : "?")).join("");

const wrapped = (font: PDFFont, line: string) => {
  const room = pageWidth - margin * 2;
  const rows: string[] = [];
  let row = "";
  for (const word of line.split(" ")) {
    const next = row === "" ? word : `${row} ${word}`;
    if (row !== "" && font.widthOfTextAtSize(next, bodySize) > room) {
      rows.push(row);
      row = word;
    } else {
      row = next;
    }
  }
  return [...rows, row];
};

export async function reportPdf(title: string, lines: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(bytesOfBase64(notoRegular), { subset: true });
  const bold = await doc.embedFont(bytesOfBase64(notoBold), { subset: true });
  const rows = lines.flatMap((line) => wrapped(regular, printable(regular, line)));
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin - titleSize;
  page.drawText(printable(bold, title), { x: margin, y, size: titleSize, font: bold });
  y -= titleGap;
  rows.forEach((row) => {
    if (y < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin - bodySize;
    }
    if (row !== "") page.drawText(row, { x: margin, y, size: bodySize, font: regular });
    y -= leading;
  });
  return doc.save();
}

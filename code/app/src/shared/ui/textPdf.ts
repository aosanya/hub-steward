const pageHeight = 842;
const pageWidth = 595;
const margin = 50;
const titleSize = 16;
const bodySize = 11;
const leading = 16;
const firstLine = pageHeight - margin - 30;
const lastLine = margin + 10;
const wrapAt = 90;

const nearest: Record<string, string> = { "ő": "ö", "Ő": "Ö", "ű": "ü", "Ű": "Ü" };

const letterOf = (char: string) => {
  const code = char.codePointAt(0) ?? 63;
  if (nearest[char]) return nearest[char];
  if (code < 32 || (code > 126 && code < 160) || code > 255) return "?";
  return char;
};

const escaped = (value: string) =>
  Array.from(value, letterOf)
    .join("")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const wrapped = (line: string) => {
  if (line.length <= wrapAt) return [line];
  const rows: string[] = [];
  let row = "";
  for (const word of line.split(" ")) {
    if (row !== "" && `${row} ${word}`.length > wrapAt) {
      rows.push(row);
      row = word;
    } else {
      row = row === "" ? word : `${row} ${word}`;
    }
  }
  return [...rows, row];
};

const pagesOf = (lines: string[]) => {
  const perPage = Math.floor((firstLine - lastLine) / leading) + 1;
  const rows = lines.flatMap(wrapped);
  const pages: string[][] = [];
  for (let at = 0; at < Math.max(rows.length, 1); at += perPage) pages.push(rows.slice(at, at + perPage));
  return pages;
};

const contentOf = (rows: string[], title: string | null, startY: number) => {
  const head = title === null ? "" : `BT /F2 ${titleSize} Tf ${margin} ${pageHeight - margin} Td (${escaped(title)}) Tj ET\n`;
  const body = rows.map((row, index) => `BT /F1 ${bodySize} Tf ${margin} ${startY - index * leading} Td (${escaped(row)}) Tj ET\n`).join("");
  return head + body;
};

export function textPdf(title: string, lines: string[]): Uint8Array {
  const pages = pagesOf(lines);
  const objects: string[] = [];
  const kids = pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ");
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  pages.forEach((rows, index) => {
    const content = contentOf(rows, index === 0 ? title : null, index === 0 ? firstLine : pageHeight - margin);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + index * 2} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
  });
  let out = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const at = out.length;
    out += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return at;
  });
  const table = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((at) => `${String(at).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${table}\n%%EOF\n`;
  return Uint8Array.from(out, (char) => char.charCodeAt(0) & 255);
}

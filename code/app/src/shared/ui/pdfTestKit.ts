import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef, decodePDFRawStream } from "pdf-lib";

const latin1 = (bytes: Uint8Array) => Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");

const streamText = (stream: PDFRawStream) => latin1(decodePDFRawStream(stream).decode());

const unicodeOf = (hex: string) => {
  const units: number[] = [];
  for (let at = 0; at < hex.length; at += 4) units.push(parseInt(hex.slice(at, at + 4), 16));
  return String.fromCharCode(...units);
};

const glyphMapOf = (cmap: string) => {
  const map = new Map<number, string>();
  for (const match of cmap.matchAll(/<([0-9a-fA-F]{4})>\s*<([0-9a-fA-F]+)>/g)) map.set(parseInt(match[1], 16), unicodeOf(match[2]));
  return map;
};

const streamOf = (doc: PDFDocument, value: unknown) => {
  const found = value instanceof PDFRef ? doc.context.lookup(value) : value;
  return found instanceof PDFRawStream ? found : undefined;
};

const fontMaps = (doc: PDFDocument, resources: PDFDict) => {
  const maps = new Map<string, Map<number, string>>();
  const fonts = resources.lookup(PDFName.of("Font"), PDFDict);
  fonts.entries().forEach(([name, ref]) => {
    const font = doc.context.lookup(ref, PDFDict);
    const cmap = streamOf(doc, font.get(PDFName.of("ToUnicode")));
    if (cmap) maps.set(name.decodeText().replace(/^\//, ""), glyphMapOf(streamText(cmap)));
  });
  return maps;
};

const contentsOf = (doc: PDFDocument, page: PDFDict) => {
  const contents = page.get(PDFName.of("Contents"));
  const found = contents instanceof PDFRef ? doc.context.lookup(contents) : contents;
  const parts = found instanceof PDFArray ? found.asArray() : [contents];
  return parts.flatMap((part) => {
    const stream = streamOf(doc, part);
    return stream ? [streamText(stream)] : [];
  }).join("\n");
};

export async function pdfTextOf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  return doc
    .getPages()
    .map((page) => {
      const maps = fontMaps(doc, page.node.Resources() as PDFDict);
      let current = new Map<number, string>();
      let shown = "";
      for (const token of contentsOf(doc, page.node).matchAll(/\/(\S+)\s+[\d.]+\s+Tf|<([0-9a-fA-F]+)>\s*Tj/g)) {
        if (token[1]) current = maps.get(token[1]) ?? new Map();
        else for (let at = 0; at < token[2].length; at += 4) shown += current.get(parseInt(token[2].slice(at, at + 4), 16)) ?? "?";
        if (token[2]) shown += "\n";
      }
      return shown;
    })
    .join("\n");
}

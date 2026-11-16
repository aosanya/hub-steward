import { extensionTable, languageOf, type Language } from "./extensions";

export type ViewerKind = "markdown" | "code" | "text" | "image" | "none";

function extensionOf(name: string, extension?: string): string {
  const raw = extension ?? name.slice(name.lastIndexOf(".") + 1);
  const hasDot = extension !== undefined || name.includes(".");
  return hasDot ? raw.replace(/^\./, "").toLowerCase() : "";
}

export function viewerFor(name: string, extension?: string): ViewerKind {
  const ext = extensionOf(name, extension);
  if (extensionTable.codeNames.includes(name.toLowerCase())) return "code";
  if (extensionTable.code.includes(ext)) return "code";
  if (extensionTable.markdown.includes(ext)) return "markdown";
  if (extensionTable.image.includes(ext)) return "image";
  return "text";
}

export function languageFor(name: string, extension?: string): Language {
  if (viewerFor(name, extension) !== "code") return "plain";
  const byName = languageOf[name.toLowerCase()];
  return byName ?? languageOf[extensionOf(name, extension)] ?? "plain";
}

import { viewerFor, type ViewerKind } from "./viewer/viewerFor";

const byExtension: Record<string, string> = {
  go: "Go code",
  mod: "Go module",
  sum: "Go checksums",
  ts: "TypeScript code",
  tsx: "TypeScript code",
  js: "JavaScript code",
  jsx: "JavaScript code",
  mjs: "JavaScript code",
  cjs: "JavaScript code",
  rb: "Ruby code",
  py: "Python code",
  rs: "Rust code",
  java: "Java code",
  kt: "Kotlin code",
  swift: "Swift code",
  c: "C code",
  h: "C header",
  cpp: "C++ code",
  sql: "SQL code",
  sh: "Shell script",
  json: "JSON data",
  yaml: "YAML data",
  yml: "YAML data",
  toml: "TOML data",
  css: "Stylesheet",
  html: "HTML page",
  xml: "XML document",
  md: "Markdown document",
  markdown: "Markdown document",
  mdx: "Markdown document",
  txt: "Text file",
  log: "Log file",
  csv: "Table of values",
};

const byViewer: Record<ViewerKind, string> = {
  code: "Code file",
  markdown: "Markdown document",
  text: "Text file",
  image: "Image",
  none: "File",
};

export const extensionOf = (name: string) => (name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "");

export const kindOf = (name: string) => byExtension[extensionOf(name)] ?? byViewer[viewerFor(name)];

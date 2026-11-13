export type Language =
  | "go"
  | "json"
  | "script"
  | "shell"
  | "python"
  | "sql"
  | "css"
  | "markup"
  | "yaml"
  | "c"
  | "plain";

const codeNames = ["dockerfile", "makefile"];

export const languageOf: Record<string, Language> = {
  go: "go",
  mod: "go",
  sum: "go",
  ts: "script",
  tsx: "script",
  js: "script",
  jsx: "script",
  mjs: "script",
  cjs: "script",
  rb: "script",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "yaml",
  sh: "shell",
  env: "shell",
  dockerfile: "shell",
  makefile: "shell",
  py: "python",
  rs: "c",
  java: "c",
  kt: "c",
  swift: "c",
  c: "c",
  h: "c",
  cpp: "c",
  css: "css",
  html: "markup",
  xml: "markup",
  sql: "sql",
};

export const extensionTable = {
  code: Object.keys(languageOf).filter((key) => !codeNames.includes(key)),
  markdown: ["md", "markdown", "mdx"],
  text: ["txt", "log", "csv"],
  image: ["png", "jpg", "jpeg", "gif", "webp", "svg"],
  codeNames,
};

import type { Element, ElementContent, Root } from "hast";
import dart from "highlight.js/lib/languages/dart";
import { common, createLowlight } from "lowlight";
import type { Language } from "./extensions";

export type TokenKind = "plain" | "keyword" | "string" | "comment" | "number" | "function";

export type Token = { kind: TokenKind; text: string };

const lowlight = createLowlight(common);
lowlight.register({ dart });

const kindByClass: Record<string, TokenKind> = {
  "hljs-comment": "comment",
  "hljs-quote": "comment",
  "hljs-doctag": "comment",
  "hljs-string": "string",
  "hljs-regexp": "string",
  "hljs-number": "number",
  "hljs-keyword": "keyword",
  "hljs-literal": "keyword",
  "hljs-name": "keyword",
  "hljs-built_in": "keyword",
  "hljs-attr": "function",
};

function kindOf(element: Element): TokenKind {
  const classes = (element.properties?.className as string[] | undefined) ?? [];
  if (classes.includes("hljs-title") && classes.includes("function_")) return "function";
  for (const name of classes) {
    const kind = kindByClass[name];
    if (kind) return kind;
  }
  return "plain";
}

function splitLines(source: string): string[] {
  const lines = source.split(/\r\n|\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function plainLines(lines: string[]): Token[][] {
  return lines.map((line): Token[] => (line === "" ? [] : [{ kind: "plain", text: line }]));
}

function pushText(lines: Token[][], kind: TokenKind, text: string) {
  const parts = text.split("\n");
  parts.forEach((part, index) => {
    if (index > 0) lines.push([]);
    if (part === "") return;
    const current = lines[lines.length - 1];
    const last = current[current.length - 1];
    if (last && last.kind === kind && kind === "plain") last.text += part;
    else current.push({ kind, text: part });
  });
}

function walk(nodes: ElementContent[] | Root["children"], inherited: TokenKind, lines: Token[][]) {
  for (const node of nodes) {
    if (node.type === "text") pushText(lines, inherited, node.value);
    else if (node.type === "element") walk(node.children, inherited === "plain" ? kindOf(node) : inherited, lines);
  }
}

export function highlight(source: string, language: Language): Token[][] {
  const lines = splitLines(source);
  if (!lowlight.registered(language)) return plainLines(lines);
  const tree = lowlight.highlight(language, lines.join("\n"));
  const result: Token[][] = [[]];
  walk(tree.children, "plain", result);
  return result;
}

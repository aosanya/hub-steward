import { createElement } from "react";
import type { ReactNode } from "react";

type Align = "left" | "center" | "right" | null;

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; start: number; items: Block[][] }
  | { kind: "quote"; blocks: Block[] }
  | { kind: "code"; text: string }
  | { kind: "rule" }
  | { kind: "table"; head: string[]; align: Align[]; rows: string[][] };

type Marker = { indent: number; ordered: boolean; number: number; width: number; content: string };

const maxBlockDepth = 16;
const maxInlineDepth = 8;
const maxLinkScan = 2000;
const safeLink = /^(https?:|mailto:)/i;
const markerPattern = /^( *)([-*+]|\d{1,9}[.)])( +|$)(.*)$/;
const fencePattern = /^ {0,3}(`{3,}|~{3,})(.*)$/;

const indentOf = (line: string): number => {
  let count = 0;
  while (count < line.length && line[count] === " ") count++;
  return count;
};

const isBlank = (line: string): boolean => line.trim() === "";
const isSpace = (char: string | undefined): boolean => char === undefined || char === " " || char === "\n" || char === "\t";
const isAlnum = (char: string | undefined): boolean => char !== undefined && /[\p{L}\p{N}]/u.test(char);

const dedent = (line: string, width: number): string => line.slice(Math.min(indentOf(line), width));

const fenceOpen = (line: string): { char: string; length: number } | null => {
  const match = fencePattern.exec(line);
  if (!match) return null;
  const run = match[1];
  if (run[0] === "`" && match[2].includes("`")) return null;
  return { char: run[0], length: run.length };
};

const isFenceClose = (line: string, open: { char: string; length: number }): boolean => {
  const text = line.trim();
  if (text.length < open.length) return false;
  for (const char of text) if (char !== open.char) return false;
  return true;
};

const headingOf = (line: string): { level: number; text: string } | null => {
  const indent = indentOf(line);
  if (indent > 3) return null;
  let level = 0;
  while (line[indent + level] === "#") level++;
  if (level < 1 || level > 6) return null;
  const next = line[indent + level];
  if (next !== undefined && next !== " " && next !== "\t") return null;
  let text = line.slice(indent + level).trim();
  let end = text.length;
  while (end > 0 && text[end - 1] === "#") end--;
  if (end === 0) text = "";
  else if (text[end - 1] === " ") text = text.slice(0, end).trimEnd();
  return { level, text };
};

const isRule = (line: string): boolean => {
  if (indentOf(line) > 3) return false;
  const text = line.trim();
  const char = text[0];
  if (char !== "-" && char !== "*" && char !== "_") return false;
  let count = 0;
  for (const each of text) {
    if (each === char) count++;
    else if (each !== " " && each !== "\t") return false;
  }
  return count >= 3;
};

const isQuote = (line: string): boolean => indentOf(line) <= 3 && line.trimStart().startsWith(">");

const stripQuote = (line: string): string => {
  const text = line.trimStart().slice(1);
  return text.startsWith(" ") ? text.slice(1) : text;
};

const listMarker = (line: string): Marker | null => {
  const match = markerPattern.exec(line);
  if (!match) return null;
  const marker = match[2];
  const spaces = match[3].length;
  const ordered = marker.length > 1 || /\d/.test(marker);
  const gap = spaces > 4 || spaces === 0 ? 1 : spaces;
  return {
    indent: match[1].length,
    ordered,
    number: ordered ? parseInt(marker, 10) : 0,
    width: marker.length + gap,
    content: spaces > 4 ? " ".repeat(spaces - 1) + match[4] : match[4],
  };
};

const splitRow = (line: string): string[] => {
  let text = line.trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|") && !text.endsWith("\\|")) text = text.slice(0, -1);
  const cells: string[] = [];
  let cell = "";
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "\\" && text[index + 1] === "|") {
      cell += "|";
      index++;
    } else if (char === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
};

const separatorAlign = (cell: string): Align | undefined => {
  let text = cell.trim();
  const left = text.startsWith(":");
  const right = text.endsWith(":");
  if (left) text = text.slice(1);
  if (right) text = text.slice(0, -1);
  if (text.length === 0) return undefined;
  for (const char of text) if (char !== "-") return undefined;
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return null;
};

const tableStart = (lines: string[], index: number): { head: string[]; align: Align[] } | null => {
  if (index + 1 >= lines.length || !lines[index].includes("|") || !lines[index + 1].includes("-")) return null;
  const head = splitRow(lines[index]);
  const separator = splitRow(lines[index + 1]);
  if (head.length !== separator.length) return null;
  const align: Align[] = [];
  for (const cell of separator) {
    const found = separatorAlign(cell);
    if (found === undefined) return null;
    align.push(found);
  }
  return { head, align };
};

const interruptsParagraph = (lines: string[], index: number): boolean => {
  const line = lines[index];
  if (fenceOpen(line) || headingOf(line) || isRule(line) || isQuote(line)) return true;
  const marker = listMarker(line);
  if (marker && marker.content.trim() !== "" && (!marker.ordered || marker.number === 1)) return true;
  return tableStart(lines, index) !== null;
};

const parseList = (lines: string[], from: number, depth: number): [Block, number] => {
  const first = listMarker(lines[from]) as Marker;
  const base = first.indent;
  const items: Block[][] = [];
  let index = from;
  while (index < lines.length) {
    const marker = listMarker(lines[index]);
    if (!marker || marker.ordered !== first.ordered || isRule(lines[index])) break;
    const contentIndent = marker.indent + marker.width;
    const itemLines = [marker.content];
    index++;
    while (index < lines.length) {
      const line = lines[index];
      if (isBlank(line)) {
        let next = index;
        while (next < lines.length && isBlank(lines[next])) next++;
        if (next >= lines.length) {
          index = next;
          break;
        }
        if (indentOf(lines[next]) > base) {
          itemLines.push("");
          index = next;
          continue;
        }
        const sibling = listMarker(lines[next]);
        if (sibling && sibling.ordered === first.ordered && !isRule(lines[next])) index = next;
        break;
      }
      if (indentOf(line) > base) {
        itemLines.push(dedent(line, contentIndent));
        index++;
        continue;
      }
      const previous = itemLines[itemLines.length - 1];
      if (listMarker(line) || isRule(line) || fenceOpen(line) || headingOf(line) || isQuote(line) || isBlank(previous)) break;
      itemLines.push(line.trim());
      index++;
    }
    items.push(parseBlocks(itemLines, depth + 1));
  }
  return [{ kind: "list", ordered: first.ordered, start: first.number, items }, index];
};

const parseBlocks = (rawLines: string[], depth: number): Block[] => {
  const blocks: Block[] = [];
  if (depth > maxBlockDepth) {
    const text = rawLines.join("\n").trim();
    return text ? [{ kind: "paragraph", text }] : [];
  }
  const lines = rawLines;
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (isBlank(line)) {
      index++;
      continue;
    }
    const open = fenceOpen(line);
    if (open) {
      const body: string[] = [];
      const lead = indentOf(line);
      index++;
      while (index < lines.length && !isFenceClose(lines[index], open)) {
        body.push(dedent(lines[index], lead));
        index++;
      }
      index++;
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }
    const heading = headingOf(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading.level, text: heading.text });
      index++;
      continue;
    }
    if (isRule(line)) {
      blocks.push({ kind: "rule" });
      index++;
      continue;
    }
    if (isQuote(line)) {
      const inner: string[] = [];
      while (index < lines.length && isQuote(lines[index])) {
        inner.push(stripQuote(lines[index]));
        index++;
      }
      blocks.push({ kind: "quote", blocks: parseBlocks(inner, depth + 1) });
      continue;
    }
    if (listMarker(line)) {
      const [list, next] = parseList(lines, index, depth);
      blocks.push(list);
      index = next;
      continue;
    }
    const table = tableStart(lines, index);
    if (table) {
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && !isBlank(lines[index]) && lines[index].includes("|")) {
        const cells = splitRow(lines[index]);
        rows.push(table.head.map((_, column) => cells[column] ?? ""));
        index++;
      }
      blocks.push({ kind: "table", head: table.head, align: table.align, rows });
      continue;
    }
    const paragraph = [line.trimStart()];
    index++;
    while (index < lines.length && !isBlank(lines[index]) && !interruptsParagraph(lines, index)) {
      paragraph.push(lines[index].trimStart());
      index++;
    }
    blocks.push({ kind: "paragraph", text: paragraph.join("\n").trimEnd() });
  }
  return blocks;
};

const pushText = (out: ReactNode[], text: string): void => {
  const pieces = text.split("\n");
  pieces.forEach((piece, position) => {
    if (position === pieces.length - 1) {
      if (piece) out.push(piece);
      return;
    }
    const hard = piece.endsWith("\\") || piece.endsWith("  ");
    const body = piece.endsWith("\\") ? piece.slice(0, -1) : piece;
    if (body.trimEnd()) out.push(body.trimEnd());
    if (hard) out.push(createElement("br", { key: out.length }));
    else out.push(" ");
  });
};

const findCloser = (text: string, from: number, delimiter: string, missing: Map<string, number>): number => {
  const failed = missing.get(delimiter);
  if (failed !== undefined && from >= failed) return -1;
  let index = from;
  while (index < text.length) {
    const char = text[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (delimiter.length === 2) {
      if (text.startsWith(delimiter, index) && index > from && !isSpace(text[index - 1])) return index;
      index++;
      continue;
    }
    if (char === delimiter) {
      let end = index;
      while (text[end] === delimiter) end++;
      const single = end - index === 1;
      if (single && index > from && !isSpace(text[index - 1]) && (delimiter !== "_" || !isAlnum(text[end]))) return index;
      index = end;
      continue;
    }
    index++;
  }
  missing.set(delimiter, Math.min(failed ?? from, from));
  return -1;
};

type Link = { text: string; url: string; end: number };

const parseLink = (text: string, start: number): Link | null => {
  const limit = Math.min(text.length, start + maxLinkScan);
  let depth = 1;
  let close = -1;
  for (let index = start + 1; index < limit; index++) {
    const char = text[index];
    if (char === "\\") index++;
    else if (char === "[") depth++;
    else if (char === "]" && --depth === 0) {
      close = index;
      break;
    }
  }
  if (close < 0 || text[close + 1] !== "(") return null;
  const parenLimit = Math.min(text.length, close + 2 + maxLinkScan);
  let level = 1;
  for (let index = close + 2; index < parenLimit; index++) {
    const char = text[index];
    if (char === "\\") index++;
    else if (char === "(") level++;
    else if (char === ")" && --level === 0) {
      const raw = text.slice(close + 2, index).trim();
      const url = raw.startsWith("<") ? raw.slice(1).split(">")[0] : raw.split(/\s/)[0];
      return { text: text.slice(start + 1, close), url, end: index + 1 };
    }
  }
  return null;
};

const parseCodeSpan = (text: string, start: number, missing: Map<string, number>): { code: string; end: number; run: number } => {
  let run = 1;
  while (text[start + run] === "`") run++;
  const fence = "`".repeat(run);
  const failed = missing.get(fence);
  if (failed === undefined || start < failed) {
    let from = start + run;
    while (true) {
      const found = text.indexOf(fence, from);
      if (found < 0) break;
      let end = found;
      while (text[end] === "`") end++;
      if (end - found === run) {
        let code = text.slice(start + run, found).replace(/\n/g, " ");
        if (code.length > 2 && code.startsWith(" ") && code.endsWith(" ") && code.trim() !== "") code = code.slice(1, -1);
        return { code, end, run };
      }
      from = end;
    }
    missing.set(fence, Math.min(failed ?? start, start));
  }
  return { code: "", end: -1, run };
};

const inline = (text: string, inLink: boolean, depth: number): ReactNode[] => {
  if (depth > maxInlineDepth) return [text];
  const out: ReactNode[] = [];
  const missing = new Map<string, number>();
  let buffer = "";
  const flush = () => {
    if (buffer) pushText(out, buffer);
    buffer = "";
  };
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === "\\" && index + 1 < text.length && /[!-/:-@[-`{-~]/.test(text[index + 1])) {
      buffer += text[index + 1];
      index += 2;
      continue;
    }
    if (char === "`") {
      const span = parseCodeSpan(text, index, missing);
      if (span.end < 0) {
        buffer += "`".repeat(span.run);
        index += span.run;
      } else {
        flush();
        out.push(createElement("code", { key: out.length }, span.code));
        index = span.end;
      }
      continue;
    }
    if (char === "!" && text[index + 1] === "[") {
      const link = parseLink(text, index + 1);
      if (link) {
        buffer += link.text;
        index = link.end;
      } else {
        buffer += "!";
        index++;
      }
      continue;
    }
    if (char === "[") {
      const link = parseLink(text, index);
      if (link) {
        flush();
        const children = inline(link.text, true, depth + 1);
        if (safeLink.test(link.url) && !inLink) {
          out.push(createElement("a", { key: out.length, href: link.url, target: "_blank", rel: "noopener noreferrer" }, ...children));
        } else {
          out.push(...children);
        }
        index = link.end;
      } else {
        buffer += "[";
        index++;
      }
      continue;
    }
    if (char === "*" || char === "_" || char === "~") {
      const double = text[index + 1] === char && char !== "~" ? char + char : char === "~" && text[index + 1] === "~" ? "~~" : null;
      const delimiter = double ?? char;
      const length = delimiter.length;
      const intraword = char === "_" && isAlnum(text[index - 1]);
      const opens = !isSpace(text[index + length]) && !intraword && (double !== null || char !== "~");
      const closer = opens ? findCloser(text, index + length, delimiter, missing) : -1;
      if (closer > index + length) {
        flush();
        const children = inline(text.slice(index + length, closer), inLink, depth + 1);
        const tag = delimiter === "~~" ? "del" : length === 2 ? "strong" : "em";
        out.push(createElement(tag, { key: out.length }, ...children));
        index = closer + length;
      } else {
        buffer += delimiter;
        index += length;
      }
      continue;
    }
    buffer += char;
    index++;
  }
  flush();
  return out;
};

const renderBlock = (block: Block, key: number, tight: boolean): ReactNode => {
  switch (block.kind) {
    case "heading":
      return createElement(`h${block.level}`, { key }, ...inline(block.text, false, 0));
    case "paragraph":
      return tight ? <span key={key}>{inline(block.text, false, 0)}</span> : <p key={key}>{inline(block.text, false, 0)}</p>;
    case "list": {
      const items = block.items.map((item, position) => <li key={position}>{renderBlocks(item, true)}</li>);
      return block.ordered ? (
        <ol key={key} start={block.start !== 1 ? block.start : undefined}>
          {items}
        </ol>
      ) : (
        <ul key={key}>{items}</ul>
      );
    }
    case "quote":
      return <blockquote key={key}>{renderBlocks(block.blocks, false)}</blockquote>;
    case "code":
      return (
        <pre key={key}>
          <code>{block.text}</code>
        </pre>
      );
    case "rule":
      return <hr key={key} />;
    case "table": {
      const style = (column: number) => (block.align[column] ? { textAlign: block.align[column] as "left" | "center" | "right" } : undefined);
      return (
        <table key={key}>
          <thead>
            <tr>
              {block.head.map((cell, column) => (
                <th key={column} style={style(column)}>
                  {inline(cell, false, 0)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, position) => (
              <tr key={position}>
                {row.map((cell, column) => (
                  <td key={column} style={style(column)}>
                    {inline(cell, false, 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  }
};

const renderBlocks = (blocks: Block[], tight: boolean): ReactNode[] =>
  blocks.map((block, position) => renderBlock(block, position, tight && block.kind === "paragraph"));

export function MarkdownPage({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
  return <div className="doc-page">{renderBlocks(parseBlocks(lines, 0), false)}</div>;
}

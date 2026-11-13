import type { Language } from "./extensions";

export type TokenKind = "plain" | "keyword" | "string" | "comment" | "number" | "function";

export type Token = { kind: TokenKind; text: string };

type Quote = { open: string; close: string; multiline: boolean; escapes: boolean };

type Block = { open: string; close: string };

type Grammar = {
  lineComments: string[];
  blocks: Block[];
  quotes: Quote[];
  keywords: Set<string>;
  caseless: boolean;
  calls: boolean;
};

type Open = { kind: "comment" | "string"; close: string; escapes: boolean; multiline: boolean };

const words = (list: string) => new Set(list.split(" "));

const quote = (mark: string, multiline = false, escapes = true): Quote => ({ open: mark, close: mark, multiline, escapes });

const cBlock: Block = { open: "/*", close: "*/" };

const doubleAndSingle = [quote('"'), quote("'")];

const goKeywords = words(
  "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil iota",
);

const scriptKeywords = words(
  "async await break case catch class const continue debugger default delete do else enum export extends false finally for from function if implements import in instanceof interface let new null of private protected public readonly return static super switch this throw true try type typeof undefined var void while with yield as",
);

const shellKeywords = words(
  "if then else elif fi for while until do done case esac in function select time export local readonly return exit break continue unset source alias set true false",
);

const pythonKeywords = words(
  "and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield True False None self",
);

const sqlKeywords = words(
  "select from where and or not null insert into values update set delete create table alter drop index view join inner left right outer full cross on as group by order having limit offset union all distinct case when then else end primary key foreign references default unique check constraint begin commit rollback with returning in is like between exists true false if",
);

const cssKeywords = words("important inherit initial unset none auto");

const yamlKeywords = words("true false null yes no on off");

const cKeywords = words(
  "auto break case char const continue default do double else enum extern float for goto if inline int long register return short signed sizeof static struct switch typedef union unsigned void volatile while class namespace template typename public private protected virtual new delete this nullptr true false bool using include define ifdef ifndef endif",
);

const jsonKeywords = words("true false null");

const plainGrammar: Grammar = {
  lineComments: [],
  blocks: [],
  quotes: [],
  keywords: new Set(),
  caseless: false,
  calls: false,
};

const grammars: Record<Language, Grammar> = {
  go: {
    lineComments: ["//"],
    blocks: [cBlock],
    quotes: [quote("`", true, false), ...doubleAndSingle],
    keywords: goKeywords,
    caseless: false,
    calls: true,
  },
  json: {
    lineComments: [],
    blocks: [],
    quotes: [quote('"')],
    keywords: jsonKeywords,
    caseless: false,
    calls: false,
  },
  script: {
    lineComments: ["//"],
    blocks: [cBlock],
    quotes: [quote("`", true), ...doubleAndSingle],
    keywords: scriptKeywords,
    caseless: false,
    calls: true,
  },
  shell: {
    lineComments: ["#"],
    blocks: [],
    quotes: doubleAndSingle,
    keywords: shellKeywords,
    caseless: false,
    calls: false,
  },
  python: {
    lineComments: ["#"],
    blocks: [],
    quotes: [quote('"""', true), quote("'''", true), ...doubleAndSingle],
    keywords: pythonKeywords,
    caseless: false,
    calls: true,
  },
  sql: {
    lineComments: ["--"],
    blocks: [cBlock],
    quotes: doubleAndSingle,
    keywords: sqlKeywords,
    caseless: true,
    calls: true,
  },
  css: {
    lineComments: [],
    blocks: [cBlock],
    quotes: doubleAndSingle,
    keywords: cssKeywords,
    caseless: false,
    calls: true,
  },
  markup: {
    lineComments: [],
    blocks: [{ open: "<!--", close: "-->" }],
    quotes: [quote('"')],
    keywords: new Set(),
    caseless: false,
    calls: false,
  },
  yaml: {
    lineComments: ["#"],
    blocks: [],
    quotes: doubleAndSingle,
    keywords: yamlKeywords,
    caseless: true,
    calls: false,
  },
  c: {
    lineComments: ["//"],
    blocks: [cBlock],
    quotes: doubleAndSingle,
    keywords: cKeywords,
    caseless: false,
    calls: true,
  },
  plain: plainGrammar,
};

function isWordStart(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95 || code === 36;
}

function isDigit(code: number): boolean {
  return code >= 48 && code <= 57;
}

function isNumberPart(code: number): boolean {
  return isDigit(code) || isWordStart(code) || code === 46;
}

function findClose(line: string, from: number, close: string, escapes: boolean): number {
  for (let i = from; i < line.length; i++) {
    if (escapes && line[i] === "\\") {
      i++;
      continue;
    }
    if (line.startsWith(close, i)) return i + close.length;
  }
  return -1;
}

function splitLines(source: string): string[] {
  const lines = source.split(/\r\n|\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function scanLine(line: string, grammar: Grammar, carried: Open | null): { tokens: Token[]; open: Open | null } {
  const tokens: Token[] = [];
  let open = carried;
  const push = (kind: TokenKind, text: string) => {
    if (text === "") return;
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind && kind === "plain") last.text += text;
    else tokens.push({ kind, text });
  };
  let pos = 0;
  let openerLength = 0;
  while (pos < line.length) {
    if (open) {
      const end = findClose(line, pos + openerLength, open.close, open.escapes);
      openerLength = 0;
      if (end === -1) {
        push(open.kind, line.slice(pos));
        pos = line.length;
      } else {
        push(open.kind, line.slice(pos, end));
        open = null;
        pos = end;
      }
      continue;
    }
    const lineComment = grammar.lineComments.find((mark) => line.startsWith(mark, pos));
    if (lineComment) {
      push("comment", line.slice(pos));
      pos = line.length;
      continue;
    }
    const block = grammar.blocks.find((candidate) => line.startsWith(candidate.open, pos));
    if (block) {
      open = { kind: "comment", close: block.close, escapes: false, multiline: true };
      openerLength = block.open.length;
      continue;
    }
    const opener = grammar.quotes.find((candidate) => line.startsWith(candidate.open, pos));
    if (opener) {
      open = { kind: "string", close: opener.close, escapes: opener.escapes, multiline: opener.multiline };
      openerLength = opener.open.length;
      continue;
    }
    const code = line.charCodeAt(pos);
    if (isWordStart(code)) {
      let end = pos + 1;
      while (end < line.length && (isWordStart(line.charCodeAt(end)) || isDigit(line.charCodeAt(end)))) end++;
      const word = line.slice(pos, end);
      const key = grammar.caseless ? word.toLowerCase() : word;
      if (grammar.keywords.has(key)) push("keyword", word);
      else if (grammar.calls && line[end] === "(") push("function", word);
      else push("plain", word);
      pos = end;
      continue;
    }
    if (isDigit(code)) {
      let end = pos + 1;
      while (end < line.length && isNumberPart(line.charCodeAt(end))) end++;
      push("number", line.slice(pos, end));
      pos = end;
      continue;
    }
    push("plain", line[pos]);
    pos++;
  }
  if (open && !open.multiline) open = null;
  return { tokens, open };
}

export function highlight(source: string, language: Language): Token[][] {
  const grammar = grammars[language] ?? plainGrammar;
  let open: Open | null = null;
  return splitLines(source).map((line) => {
    const result = scanLine(line, grammar, open);
    open = result.open;
    return result.tokens;
  });
}

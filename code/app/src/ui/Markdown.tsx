import type { ReactNode } from "react";

const codeSpan = /(`[^`]+`)/;
const links = /(\[[^\]]+\]\(https?:\/\/[^)\s]+\))/;
const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/;
const bullet = /^\s*[-*]\s+(.*)$/;
const numbered = /^\s*\d+[.)]\s+(.*)$/;

const atoms = (text: string, at: number): ReactNode[] =>
  text.split(links).map((part, index) => {
    const found = link.exec(part);
    return found ? (
      <a key={`${at}-${index}`} href={found[2]} target="_blank" rel="noreferrer">
        {found[1]}
      </a>
    ) : (
      part
    );
  });

const inline = (text: string): ReactNode[] => {
  const out: ReactNode[] = [];
  let open: ReactNode[] | null = null;
  const push = (node: ReactNode) => (open ?? out).push(node);
  text.split(codeSpan).forEach((segment, at) => {
    if (at % 2 === 1) {
      push(<code key={at}>{segment.slice(1, -1)}</code>);
      return;
    }
    segment.split("**").forEach((piece, index) => {
      if (index > 0) {
        if (open) {
          out.push(<strong key={`${at}-${index}`}>{open}</strong>);
          open = null;
        } else open = [];
      }
      atoms(piece, at * 1000 + index).forEach((node) => push(node));
    });
  });
  if (open) out.push("**", ...(open as ReactNode[]));
  return out;
};

type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] };

const blocksOf = (text: string): Block[] => {
  const blocks: Block[] = [];
  for (const line of text.split("\n")) {
    const item = bullet.exec(line) ?? numbered.exec(line);
    const kind = item ? (bullet.test(line) ? "ul" : "ol") : "p";
    const last = blocks[blocks.length - 1];
    if (line.trim() === "") {
      if (last?.kind === "p" && last.lines.length > 0) blocks.push({ kind: "p", lines: [] });
      continue;
    }
    if (item && last && last.kind === kind && kind !== "p") (last as { items: string[] }).items.push(item[1]);
    else if (item) blocks.push({ kind: kind as "ul" | "ol", items: [item[1]] });
    else if (last?.kind === "p") last.lines.push(line);
    else blocks.push({ kind: "p", lines: [line] });
  }
  return blocks.filter((block) => (block.kind === "p" ? block.lines.length > 0 : block.items.length > 0));
};

export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className ? `md ${className}` : "md"}>
      {blocksOf(text).map((block, at) => {
        if (block.kind === "p") {
          return (
            <p key={at}>
              {block.lines.map((line, row) => (
                <span key={row}>
                  {row > 0 ? <br /> : null}
                  {inline(line)}
                </span>
              ))}
            </p>
          );
        }
        const List = block.kind;
        return (
          <List key={at}>
            {block.items.map((item, row) => (
              <li key={row}>{inline(item)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}

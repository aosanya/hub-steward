import { Link, useLocation } from "react-router-dom";
import { Markdown } from "../../../shared/ui/Markdown";
import { backState } from "../../../shared/ui/backTo";
import { rulePath } from "./paths";

const approval = /^(.*?\bApproval: )(D-\d+)(.*)$/;

type Part = { text: string } | { before: string; code: string; after: string };

const partsOf = (body: string): Part[] =>
  body.split("\n").reduce<Part[]>((parts, line) => {
    const found = approval.exec(line);
    if (found) return [...parts, { before: found[1], code: found[2], after: found[3] }];
    const last = parts[parts.length - 1];
    if (last && "text" in last) return [...parts.slice(0, -1), { text: `${last.text}\n${line}` }];
    return [...parts, { text: line }];
  }, []);

type Props = { text: string; backLabel: string; className?: string };

export function RuleBody({ text, backLabel, className }: Props) {
  const here = useLocation();
  return (
    <>
      {partsOf(text).map((part, at) =>
        "text" in part ? (
          part.text.trim() === "" ? null : <Markdown key={at} text={part.text} className={className} />
        ) : (
          <p key={at}>
            {part.before}
            <Link to={rulePath(part.code)} {...backState(here.pathname + here.search, backLabel)}>
              {part.code}
            </Link>
            {part.after}
          </p>
        ),
      )}
    </>
  );
}

import { Fragment } from "react";
import { Link, useLocation } from "react-router-dom";
import { Markdown } from "../../../shared/ui/Markdown";
import { backState } from "../../../shared/ui/backTo";
import { IssueCode, IssueName } from "../shared/IssueTitle";
import { issuePath } from "../shared/paths";
import type { RuleFile } from "../rulebook";
import { anchorOf } from "./BookContents";
import type { Refs } from "./bookClient";
import type { DatedRule } from "./bookRules";
import type { FileTarget } from "./fileTarget";
import { bookButton, cameFromWords, doneRightInWords, joinWords } from "./words";

type Props = { rule: DatedRule; refs?: Refs; fileTarget: FileTarget };

export function BookRule({ rule, refs, fileTarget }: Props) {
  const here = useLocation();
  const back = backState(here.pathname + here.search, bookButton);
  const fileOf = (file: RuleFile) => {
    const target = file.missing ? undefined : fileTarget(file);
    return target ? (
      <Link to={target} {...back}>
        {file.path}
      </Link>
    ) : (
      <span>{file.path}</span>
    );
  };
  const cameFrom = refs?.cameFrom ?? [];
  const files = refs?.files ?? [];
  return (
    <section className="book-rule">
      <h3 id={anchorOf(rule.code)}>
        <IssueCode title={rule.title} code={rule.code} /> <IssueName title={rule.title} code={rule.code} full />
      </h3>
      {rule.body !== "" ? <Markdown text={rule.body} /> : null}
      {cameFrom.length + files.length > 0 ? (
        <p className="book-refs">
          {cameFrom.length > 0 ? (
            <>
              {cameFromWords}{" "}
              {joinWords(cameFrom.map((issue) => <Link key={issue.id} to={issuePath(issue.id)} {...back}>{issue.code}</Link>)).map((part, at) => (
                <Fragment key={at}>{part}</Fragment>
              ))}
              .
            </>
          ) : null}
          {cameFrom.length > 0 && files.length > 0 ? " " : null}
          {files.length > 0 ? (
            <>
              {doneRightInWords}{" "}
              {joinWords(files.map((file) => <Fragment key={file.id}>{fileOf(file)}</Fragment>)).map((part, at) => (
                <Fragment key={at}>{part}</Fragment>
              ))}
              .
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

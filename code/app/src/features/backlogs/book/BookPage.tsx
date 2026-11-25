import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell } from "../../../app/Shell";
import { useLanguage } from "../../../shared/language/language";
import { EmptyCard, LoadFailed, LoadingLine } from "../../../shared/ui/LoadState";
import { useBackLabel, useBackTo } from "../../../shared/ui/backTo";
import { openAgencyId } from "../../../shared/wakala/openAgency";
import { useLoad } from "../../forms/useLoad";
import { mcpFilesClient, type FilesClient } from "../../files";
import { noAccessWords, useFileTarget } from "../rulebook";
import { backlogsHomePath } from "../shared/paths";
import { mcpBookClient, type BookClient } from "./bookClient";
import { BookContents } from "./BookContents";
import { BookRule } from "./BookRule";
import { useRefs } from "./useRefs";
import { bookButton, bookTitle, emptyWords, loadFailedWords, readOnWords } from "./words";
import "./book.css";

type Props = { client?: BookClient; files?: Pick<FilesClient, "folders"> };

const defaultClient = mcpBookClient();

export function BookPage({ client = defaultClient, files = mcpFilesClient }: Props) {
  const navigate = useNavigate();
  const { words } = useLanguage();
  const backTo = useBackTo(backlogsHomePath());
  const backLabel = useBackLabel(words.backBacklogs);
  const [readOn] = useState(() => new Date());
  const [version, setVersion] = useState(0);
  const read = useLoad(() => client.rules(), `book:${openAgencyId()}:${version}`);
  const answer = read.state === "ready" ? read.data : null;
  const rules = answer?.state === "ready" ? answer.data : [];
  const fileTarget = useFileTarget(files, rules.length > 0);
  const refs = useRefs(client, rules.map((rule) => rule.code));
  return (
    <Shell title={bookButton} titleless onBack={() => navigate(backTo)} backLabel={backLabel}>
      {read.state === "loading" ? <LoadingLine /> : null}
      {read.state === "error" || (answer && answer.state !== "ready" && answer.state !== "no_access") ? <LoadFailed words={loadFailedWords} onRetry={() => setVersion((now) => now + 1)} /> : null}
      {answer?.state === "no_access" ? <EmptyCard words={noAccessWords} /> : null}
      {answer?.state === "ready" && rules.length === 0 ? <EmptyCard words={emptyWords} /> : null}
      {rules.length > 0 ? (
        <article className="book">
          <h1>{bookTitle}</h1>
          <p className="book-read">{readOnWords(readOn)}</p>
          <BookContents rules={rules} />
          {rules.map((rule) => (
            <BookRule key={rule.code} rule={rule} refs={refs[rule.code]} fileTarget={fileTarget} />
          ))}
        </article>
      ) : null}
    </Shell>
  );
}

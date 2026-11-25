import { useLocation, useNavigate } from "react-router-dom";
import { Chip } from "../../../shared/ui/Chip";
import { ListRow } from "../../../shared/ui/ListRow";
import { backState } from "../../../shared/ui/backTo";
import type { FilesClient } from "../../files";
import { issuePath } from "../shared/paths";
import { CodeRow } from "./CodeRow";
import { LinkedCard } from "./LinkedCard";
import type { RuleFile, RuleIssue } from "./types";
import { useFileTarget } from "./useFileTarget";
import { fileMissingWords, referencesHeading, repoLineWords } from "./words";

type Props = { code: string; files: RuleFile[]; issues: RuleIssue[]; filesClient: Pick<FilesClient, "folders"> };

const nameOf = (one: RuleFile) => (one.line > 0 ? `${one.path}:${one.line}` : one.path);

export function RecordReferences({ code, files, issues, filesClient }: Props) {
  const navigate = useNavigate();
  const here = useLocation();
  const target = useFileTarget(filesClient, files.length > 0);
  if (files.length + issues.length === 0) return null;
  return (
    <LinkedCard title={referencesHeading} defaultOpen={false}>
      {files.map((one) => {
        const address = target(one);
        const meta = [repoLineWords(one.repo), one.note];
        if (one.missing) return <ListRow key={one.id} title={nameOf(one)} meta={meta} end={<Chip tone="danger">{fileMissingWords}</Chip>} />;
        return <ListRow key={one.id} title={nameOf(one)} meta={meta} end={address ? "›" : undefined} onClick={address ? () => navigate(address, backState(here.pathname + here.search, code)) : undefined} />;
      })}
      {issues.map((one) => (
        <CodeRow key={one.id} code={one.code} title={one.title} onOpen={() => navigate(issuePath(one.id), backState(here.pathname + here.search, code))} />
      ))}
    </LinkedCard>
  );
}

import { useLocation, useNavigate } from "react-router-dom";
import { Chip } from "../../../shared/ui/Chip";
import { ListRow } from "../../../shared/ui/ListRow";
import { backState } from "../../../shared/ui/backTo";
import { openAgencyId } from "../../../shared/wakala/openAgency";
import { filePath, type FilesClient } from "../../files";
import { useLoad } from "../../forms/useLoad";
import { issuePath } from "../shared/paths";
import { CodeRow } from "./CodeRow";
import { LinkedCard } from "./LinkedCard";
import type { RuleFile, RuleIssue } from "./types";
import { fileMissingWords, referencesHeading, repoLineWords } from "./words";

type Props = { code: string; files: RuleFile[]; issues: RuleIssue[]; filesClient: Pick<FilesClient, "folders"> };

const nameOf = (one: RuleFile) => (one.line > 0 ? `${one.path}:${one.line}` : one.path);

export function RecordReferences({ code, files, issues, filesClient }: Props) {
  const navigate = useNavigate();
  const here = useLocation();
  const folders = useLoad(() => (files.length > 0 ? filesClient.folders() : Promise.resolve([])), `rule-folders:${openAgencyId()}:${code}`);
  const known = folders.state === "ready" ? folders.data : [];
  if (files.length + issues.length === 0) return null;
  return (
    <LinkedCard title={referencesHeading} defaultOpen={false}>
      {files.map((one) => {
        const folder = known.find((candidate) => candidate.name === one.repo);
        const meta = [repoLineWords(one.repo), one.note];
        if (one.missing) return <ListRow key={one.id} title={nameOf(one)} meta={meta} end={<Chip tone="danger">{fileMissingWords}</Chip>} />;
        return <ListRow key={one.id} title={nameOf(one)} meta={meta} end={folder ? "›" : undefined} onClick={folder ? () => navigate(filePath(folder.id, one.path), backState(here.pathname + here.search, code)) : undefined} />;
      })}
      {issues.map((one) => (
        <CodeRow key={one.id} code={one.code} title={one.title} onOpen={() => navigate(issuePath(one.id), backState(here.pathname + here.search, code))} />
      ))}
    </LinkedCard>
  );
}

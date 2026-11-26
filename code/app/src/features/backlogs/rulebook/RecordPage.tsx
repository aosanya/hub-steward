import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Shell } from "../../../app/Shell";
import { Card } from "../../../shared/ui/Card";
import { EmptyCard, LoadFailed, LoadingLine } from "../../../shared/ui/LoadState";
import { ListRow, Rows } from "../../../shared/ui/ListRow";
import { RuleBody } from "./RuleBody";
import { PageFrame } from "../../../app/menu/PageFrame";
import { Section } from "../../../shared/ui/Section";
import { SectionHeading } from "../../../shared/ui/SectionHeading";
import { TextChip } from "../../../shared/ui/TextChip";
import { Chip } from "../../../shared/ui/Chip";
import { dayWithYearWords } from "../../../shared/ui/days";
import { backState, useBackLabel, useBackTo } from "../../../shared/ui/backTo";
import { openAgencyId } from "../../../shared/wakala/openAgency";
import { useState } from "react";
import { mcpFilesClient, type FilesClient } from "../../files";
import { QuestionAnswers, mcpQuestionsClient, type QuestionsClient } from "../questions";
import { useLoad } from "../../forms/useLoad";
import { guardedRulebook } from "./access";
import { mcpRulebookClient } from "./api";
import { issuePath } from "../shared/paths";
import { CodeRow } from "./CodeRow";
import { LinkedCard } from "./LinkedCard";
import { rulebookPath, rulePath } from "./paths";
import { RecordReferences } from "./RecordReferences";
import { StatusMark } from "./RuleMarks";
import { priorityTone } from "./ruleStatus";
import type { OpenedRule, Rule, RulebookClient } from "./types";
import { viewOfKind } from "./viewChoice";
import { useRulebookWords, type RulebookWords } from "./words";
import "../issue/issueWide.css";
import "./rulebook.css";

type Props = { client?: RulebookClient; files?: Pick<FilesClient, "folders">; questions?: QuestionsClient };

const detailRows = (rule: Rule, { rowWords, decidedByWords }: RulebookWords) =>
  [
    <ListRow key="status" title={rowWords.status} end={<StatusMark rule={rule} />} />,
    rule.kind === "decision" && rule.decidedBy !== "" ? <ListRow key="decided" title={rowWords.decided} meta={decidedByWords(rule.decidedBy, dayWithYearWords(rule.decidedAt || rule.createdAt))} /> : null,
    rule.kind === "question" && rule.priority !== "" ? <ListRow key="priority" title={rowWords.priority} end={<Chip tone={priorityTone(rule.priority)}>{rule.priority}</Chip>} /> : null,
    rule.tags.length > 0 ? (
      <ListRow
        key="tags"
        title={rowWords.tags}
        below={
          <span className="issue-tags">
            {rule.tags.map((tag) => (
              <TextChip key={tag} text={tag} />
            ))}
          </span>
        }
      />
    ) : null,
  ].filter((row) => row !== null);

function Record({ data, files, questions, onAnswered }: { data: OpenedRule; files: Pick<FilesClient, "folders">; questions: QuestionsClient; onAnswered: () => void }) {
  const rulebook = useRulebookWords();
  const { answeredByWords, detailsHeading, kindTitle, notAnsweredWords, producedHeading, replacedByWords, replacesWords, settledInWords, whyHeading } = rulebook;
  const navigate = useNavigate();
  const here = useLocation();
  const { rule, why, answer, produced, settledIn } = data;
  const openRule = (code: string) => navigate(rulePath(code), backState(here.pathname + here.search, rule.code));
  const followed = rule.kind === "decision" ? data.issues.filter((one) => one.relation !== "decided_in") : data.issues;
  const hasReason = rule.body !== "" || why !== undefined;
  return (
    <PageFrame wide title={rule.title} line={`${rule.code} · ${kindTitle[rule.kind]}`}>
      <div className="issue-wide">
        <div className="issue-main">
          <Section word={detailsHeading} plain counted={false} rows={detailRows(rule, rulebook)} />
          {hasReason ? (
            <section className="rule-why" aria-label={whyHeading[rule.kind]}>
              <SectionHeading>{whyHeading[rule.kind]}</SectionHeading>
              {rule.body !== "" ? (
                <Card>
                  <RuleBody text={rule.body} backLabel={rule.code} className="issue-body" />
                </Card>
              ) : null}
              {why ? (
                <Rows>
                  <CodeRow code={why.code} title={why.title} onOpen={() => openRule(why.code)} />
                </Rows>
              ) : null}
            </section>
          ) : null}
          {rule.kind === "question" ? (
            rule.answeredBy === "" ? (
              <QuestionAnswers
                code={rule.code}
                client={questions}
                onAnswered={onAnswered}
                fallback={
                  <LinkedCard title={answeredByWords}>
                    <ListRow title={notAnsweredWords} />
                  </LinkedCard>
                }
              />
            ) : (
              <LinkedCard title={answeredByWords}>
                <CodeRow code={rule.answeredBy} title={answer?.title ?? ""} onOpen={() => openRule(rule.answeredBy)} />
              </LinkedCard>
            )
          ) : null}
          {rule.kind !== "question" ? <p className="sub">{`${replacesWords(rule.supersedes)} ${replacedByWords(rule.supersededBy)}`}</p> : null}
        </div>
        <div className="issue-side">
          {rule.kind === "decision" && produced.length > 0 ? (
            <LinkedCard title={producedHeading}>
              {produced.map((one) => (
                <CodeRow key={one.code} code={one.code} title={one.title} onOpen={() => openRule(one.code)} />
              ))}
            </LinkedCard>
          ) : null}
          {rule.kind === "decision" && settledIn.length > 0 ? (
            <LinkedCard title={settledInWords}>
              {settledIn.map((one) => (
                <CodeRow key={one.id} code={one.code} title={one.title} onOpen={() => navigate(issuePath(one.id), backState(here.pathname + here.search, rule.code))} />
              ))}
            </LinkedCard>
          ) : null}
          <RecordReferences code={rule.code} files={data.files} issues={followed} filesClient={files} />
        </div>
      </div>
    </PageFrame>
  );
}

export function RecordPage({ client = guardedRulebook(mcpRulebookClient()), files = mcpFilesClient, questions = mcpQuestionsClient }: Props) {
  const { loadFailedWords, missingRecordWords, noAccessWords, viewWords } = useRulebookWords();
  const navigate = useNavigate();
  const code = useParams().ruleCode ?? "";
  const [version, setVersion] = useState(0);
  const read = useLoad(() => client.open(code), `rule-record:${openAgencyId()}:${code}:${version}`);
  const answer = read.state === "ready" ? read.data : null;
  const kind = answer?.state === "ready" ? answer.data.rule.kind : "rule";
  const backTo = useBackTo(rulebookPath("all", kind));
  const backLabel = useBackLabel(viewWords[viewOfKind[kind]]);
  return (
    <Shell title={code} titleless onBack={() => navigate(backTo)} backLabel={backLabel}>
      {read.state === "loading" ? <LoadingLine /> : null}
      {read.state === "error" || answer?.state === "failed" || answer?.state === "forbidden" ? <LoadFailed words={loadFailedWords.record} onRetry={() => setVersion((now) => now + 1)} /> : null}
      {answer?.state === "missing" ? <EmptyCard words={missingRecordWords} /> : null}
      {answer?.state === "no_access" ? <EmptyCard words={noAccessWords} /> : null}
      {answer?.state === "ready" ? <Record data={answer.data} files={files} questions={questions} onAnswered={() => setVersion((now) => now + 1)} /> : null}
    </Shell>
  );
}

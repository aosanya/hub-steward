import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLoad } from "../../features/forms/useLoad";
import { useLanguage } from "../../shared/language/language";
import { Button } from "../../shared/ui/Button";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { loadDeclaredRows, rowTitleOf, type DeclaredRecord, type DeclaredRow } from "../menu/declaredRecord";
import { HomeForThis } from "./HomeForThis";
import { HomeRowActs } from "./HomeRowActs";
import { HomeRowFacts } from "./HomeRowFacts";
import { titleIn, type HomeNode } from "./homeDeclaration";
import type { HomeFacts } from "./homeFacts";
import { homeRowPagePath } from "./homePaths";
import { scopeQueryOf, withQuery, type HomeRecordRoute } from "./homeRecordRoute";
import { openedRow } from "../../features/steps/rowStep";
import { rowStepsOf, singularOf } from "./homeRowSteps";

type Props = { route: HomeRecordRoute; record: DeclaredRecord; where: { question: string; operator: string; value: string }[] | null; title: string; declared: HomeNode[]; facts: HomeFacts };

const columnsOf = (record: DeclaredRecord) => record.questions.slice(0, 3).map((question) => question.prompt);

function Detail({ route, record, row, position, title, declared, facts }: { route: HomeRecordRoute; record: DeclaredRecord; row: DeclaredRow; position: number; title: string; declared: HomeNode[]; facts: HomeFacts }) {
  const navigate = useNavigate();
  const { code, words } = useLanguage();
  const steps = rowStepsOf(declared, facts, route.entryKey, record.code, record.workflowId);
  const foot = <HomeRowActs facts={facts} recordCode={record.code} rowId={row.id} from={{ path: route.listUrl, title }} afterEdit={withQuery(route.listPath, scopeQueryOf(route.scopeRowId), `open=${openedRow}`)} afterDelete={route.listUrl} />;
  return (
    <section className="wf-detail" aria-label={rowTitleOf(record, row, position)}>
      <HomeRowFacts record={record} row={row} position={position} foot={foot} />
      <HomeForThis thing={singularOf(record.name)} nodes={[...steps.tied, ...steps.pageEntries]} facts={facts} row={{ rowId: row.id, orderId: row.orderId }} from={{ path: route.listUrl, title }} />
      {steps.page ? <Button onClick={() => navigate(homeRowPagePath(steps.page?.key ?? "", row.id))}>{words.homeOpenPage.replace("{thing}", titleIn(steps.page, code).toLocaleLowerCase())}</Button> : null}
    </section>
  );
}

export function HomeRecordTable({ route, record, where, title, declared, facts }: Props) {
  const [search] = useSearchParams();
  const [attempt, setAttempt] = useState(0);
  const [picked, setPicked] = useState(search.get("open") ?? "");
  const rows = useLoad(() => (where ? loadDeclaredRows(record.code, where) : Promise.resolve([])), `home-table:${openAgencyId()}:${route.listUrl}:${attempt}`);
  const columns = columnsOf(record);
  const list = rows.state === "ready" ? rows.data : [];
  const at = list.findIndex((row) => row.id === picked);
  return (
    <>
      <section className="wf-main" aria-label={title}>
        <header className="wf-head">
          <h2>{title}</h2>
        </header>
        <div className="wf-content">
          {rows.state === "loading" ? <LoadingLine /> : null}
          {rows.state === "error" ? <LoadFailed words="This list could not be loaded." onRetry={() => setAttempt(attempt + 1)} /> : null}
          {rows.state === "ready" && list.length === 0 ? <EmptyCard words="Nothing here yet." /> : null}
          {list.length > 0 ? (
            <table className="home-rec">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((row, index) => (
                  <tr
                    key={row.id}
                    aria-selected={row.id === picked}
                    tabIndex={0}
                    onClick={() => setPicked(row.id)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setPicked(row.id);
                    }}
                  >
                    {columns.map((column, at) => (
                      <td key={column}>{(row.answers[column] ?? "") || (at === 0 ? rowTitleOf(record, row, index + 1) : "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </section>
      {at >= 0 ? <Detail key={picked} route={route} record={record} row={list[at]} position={at + 1} title={title} declared={declared} facts={facts} /> : null}
    </>
  );
}

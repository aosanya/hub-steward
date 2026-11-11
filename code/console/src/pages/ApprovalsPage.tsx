import { useEffect, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { hubPath } from "../api";
import { ErrorLine } from "../entry/ErrorLine";
import { amendmentsSeen, approvalFacts, approvalLog, decideAllPending, isChangedSinceRead, type ApprovalFacts } from "../data/pages/approvals";
import { pageModule } from "../data/registry";
import { useI18n } from "../i18n";
import { useConsole } from "../shell/context";
import type { PageRow } from "../types";
import { ActionCard, Avatar, Button, Cell, Chip, DataTable, Detail, Empty, Row, Stack, Tabs, TextLink, TitleRow, type ChipKind } from "../ui";
import { Icon } from "../ui/Icon";
import { LoadFailed } from "./work/LoadFailed";
import { PageContent } from "./work/PageContent";
import { formatWhen } from "./work/formatWhen";
import { useLoaded } from "../shell/useLoaded";
import { useNotPublished } from "./work/useNotPublished";

const approvals = () => pageModule("approvals")!;

const tabs = [
  { id: "pending", label: "approvalsPending" },
  { id: "approved", label: "approvalsApproved" },
  { id: "declined", label: "approvalsDeclined" },
];

type Decision = "approved" | "refused";

const shown = (value: unknown) => (typeof value === "string" ? value : "");

const statusLooks: Record<string, [ChipKind, string]> = {
  pending: ["warn", "approvalsPendingApproval"],
  approved: ["ok", "approvalsApproved"],
  refused: ["bad", "approvalsDeclined"],
};

function StatusChip({ status }: { status: string }) {
  const { t } = useI18n();
  const look = Object.hasOwn(statusLooks, status) ? statusLooks[status] : null;
  return look ? <Chip kind={look[0]}>{t(look[1])}</Chip> : <Chip kind="mute">{status}</Chip>;
}

function When({ at }: { at: string }) {
  const { lang } = useI18n();
  return <>{formatWhen(at, lang)}</>;
}

const requesterLink = (hubId: string, name: string) => `${hubPath(hubId, "approvals", "pending")}?requester=${encodeURIComponent(name)}`;

const requestLink = (hubId: string, id: string) => `${hubPath(hubId, "approvals", "pending")}?request=${encodeURIComponent(id)}`;

function ApproveAll({ hubId, requester, count, onDone }: { hubId: string; requester: string; count: number; onDone: () => void }) {
  const { t } = useI18n();
  const [outcome, setOutcome] = useState<"idle" | "sending" | "done" | "failed">("idle");

  const approveAll = async () => {
    setOutcome("sending");
    const result = await decideAllPending(hubId, requester, "approved", "").catch(() => null);
    const worked = result !== null && result.failed.length === 0;
    setOutcome(worked ? "done" : "failed");
    onDone();
  };

  if (outcome !== "done" && count === 0) return null;
  if (outcome === "done") return <ActionCard title={t("approvalsAllDone").replace("{name}", requester)} state="done" buttons={[]} />;
  return (
    <>
      {outcome === "failed" && <ErrorLine>{t("submitFailed")}</ErrorLine>}
      <ActionCard
        title={t("approvalsAllTitle").replace("{n}", String(count)).replace("{name}", requester)}
        text={t("approvalsAllText")}
        state="pending"
        buttons={[
          { label: t("approvalsAllButton"), kind: "primary", onClick: approveAll, disabled: outcome === "sending" },
          { label: t("cancel"), kind: "quiet", to: hubPath(hubId, "approvals", "pending") },
        ]}
      />
    </>
  );
}

function ApprovalRows({ hubId, tab, requester, onPending }: { hubId: string; tab: string; requester: string; onPending: (count: number) => void }) {
  const { t } = useI18n();
  const { refreshMenu } = useConsole();
  const { state, reload } = useLoaded(() => approvals().rows(hubId, { state: tab, requester }), [hubId, tab, requester]);
  const [sendFailed, setSendFailed] = useState<"" | "failed" | "changed">("");

  useEffect(() => {
    if (state.kind === "ready" && tab === "pending" && requester === "") onPending(state.value.length);
  }, [state, tab, requester, onPending]);

  const decide = async (row: PageRow, decision: Decision) => {
    const outcome = await approvals()
      .actions!.decide(hubId, { id: shown(row.id), decision, seen_amendments: amendmentsSeen(row) })
      .then(
        () => "sent" as const,
        (error) => (isChangedSinceRead(error) ? ("changed" as const) : ("failed" as const)),
      );
    setSendFailed(outcome === "sent" ? "" : outcome);
    if (outcome === "failed") return;
    reload();
    if (outcome === "sent") refreshMenu();
  };

  if (state.kind === "loading") return null;
  if (state.kind === "failed") return <LoadFailed onRetry={reload} />;

  const pendingOf = (name: string) =>
    state.value.filter((candidate) => {
      const other = approvalFacts(candidate);
      return other.named && other.who === name;
    }).length;

  const rowOf = (row: PageRow, index: number) => {
    const id = shown(row.id);
    const facts = approvalFacts(row);
    const offerAll = tab === "pending" && requester === "" && facts.named && pendingOf(facts.who) > 1;
    return {
      key: id || String(index),
      cells: [
        <Cell
          key="who"
          text={facts.who}
          lead={<Avatar name={facts.who} />}
          to={facts.named ? hubPath(hubId, "users") : undefined}
          strong
          sub={
            <>
              {facts.proposedAt === "" ? null : <When at={facts.proposedAt} />}
              {offerAll ? (
                <>
                  {facts.proposedAt === "" ? null : " · "}
                  <TextLink to={requesterLink(hubId, facts.who)} size="sm">
                    {t("approvalsAllLink").replace("{name}", facts.who)}
                  </TextLink>
                </>
              ) : null}
            </>
          }
        />,
        <Cell
          key="what"
          text={shown(row.summary)}
          strong={false}
          to={requestLink(hubId, id)}
          sub={
            <>
              {facts.kind} <StatusChip status={shown(row.status)} />
            </>
          }
        />,
        <Why key="why" facts={facts} />,
      ],
      actions:
        tab === "pending" ? (
          <div className="apv-act">
            <Button kind="quiet" size="sm" icon="check" onClick={() => decide(row, "approved")}>
              {t("approve")}
            </Button>
            <Button kind="quiet" size="sm" onClick={() => decide(row, "refused")}>
              {t("decline")}
            </Button>
          </div>
        ) : undefined,
    };
  };

  return (
    <>
      {sendFailed !== "" && <ErrorLine>{t(sendFailed === "changed" ? "approvalsChangedSinceRead" : "submitFailed")}</ErrorLine>}
      {requester !== "" && (
        <ApproveAll
          hubId={hubId}
          requester={requester}
          count={state.value.length}
          onDone={() => {
            reload();
            refreshMenu();
          }}
        />
      )}
      <DataTable
        className="apv-t"
        columns={[t("approvalsWho"), t("approvalsWhat"), t("approvalsWhy")]}
        empty={t("noRows")}
        rows={state.value.map(rowOf)}
      />
    </>
  );
}

function Why({ facts }: { facts: ApprovalFacts }) {
  if (facts.proposer === "" && facts.language === "") return null;
  return (
    <Row gap={6}>
      {facts.proposer === "" ? null : (
        <Chip kind="mute">
          <Icon name="robot" size={12} />
          {facts.proposer}
        </Chip>
      )}
      {facts.language === "" ? null : <Chip kind="mute">{facts.language}</Chip>}
    </Row>
  );
}

function RequestLog({ row }: { row: PageRow }) {
  const { t, lang } = useI18n();
  const steps = {
    drafted: t("approvalsLogDrafted"),
    amended: t("approvalsLogAmended"),
    approved: t("approvalsLogApproved"),
    declined: t("approvalsLogDeclined"),
  };
  return (
    <Stack>
      <h2>{t("approvalsLog")}</h2>
      <DataTable
        columns={[t("colTime"), t("approvalsLogBy"), t("approvalsLogStep"), t("chat.colTool")]}
        empty={t("noRows")}
        rows={approvalLog(row).map((entry, index) => ({
          key: String(index),
          cells: [
            formatWhen(entry.at, lang),
            entry.by,
            entry.step === "taken" ? entry.said : steps[entry.step],
            entry.tool === "" ? "" : <span key="tool" className="count">{entry.tool}</span>,
          ],
        }))}
      />
    </Stack>
  );
}

function RequestPage({ hubId, request }: { hubId: string; request: string }) {
  const { t, lang } = useI18n();
  const { state, reload } = useLoaded(() => approvals().rows(hubId, {}), [hubId]);
  const row = state.kind === "ready" ? state.value.find((candidate) => shown(candidate.id) === request) : undefined;
  const facts = row ? approvalFacts(row) : null;
  const by = (name: string, at: string) => (at === "" ? name : `${name} · ${formatWhen(at, lang)}`);
  const waitingPage = useNotPublished(hubId, shown(row?.kind), shown(row?.status), facts?.decidedAt ?? "");
  const inTheAgency = (page: string): [string, ReactNode] => [
    t("draft.inTheAgency"),
    <span key="agency">
      <Chip kind="mute">{t("draft.notPublishedYet")}</Chip>{" "}
      <TextLink to={hubPath(hubId, page)} arrow size="sm">
        {t("draft.openPage").replace("{page}", t("menu." + page))}
      </TextLink>
    </span>,
  ];

  return (
    <>
      <TitleRow title={facts ? facts.kind : t("menu.approvals")} />
      <PageContent>
        {state.kind === "failed" ? <LoadFailed onRetry={reload} /> : null}
        {state.kind === "ready" && !row ? <Empty text={t("noRows")} /> : null}
        {row && facts ? (
          <Detail
            title={shown(row.summary)}
            pairs={[
              [t("status"), <StatusChip key="status" status={shown(row.status)} />],
              [t("approvalsWorkflow"), facts.kind],
              [t("approvalsAskedBy"), facts.who],
              [t("approvalsDraftedBy"), by(facts.proposer, facts.proposedAt)],
              ...(facts.decidedBy === ""
                ? []
                : ([[shown(row.status) === "refused" ? t("approvalsDeclinedBy") : t("approvalsApprovedBy"), by(facts.decidedBy, facts.decidedAt)]] as [string, string][])),
              ...(facts.reason === "" ? [] : ([[t("approvalsReason"), facts.reason]] as [string, string][])),
              ...(waitingPage === null ? [] : [inTheAgency(waitingPage)]),
            ]}
          />
        ) : null}
        {row && facts ? <RequestLog row={row} /> : null}
      </PageContent>
    </>
  );
}

export function ApprovalsPage() {
  const { t } = useI18n();
  const { hub } = useConsole();
  const { tab: requested } = useParams();
  const [query] = useSearchParams();
  const [pending, setPending] = useState<number | null>(null);
  const tab = tabs.find((candidate) => candidate.id === requested)?.id ?? "pending";
  const request = query.get("request");
  const requester = tab === "pending" ? (query.get("requester") ?? "") : "";

  if (request) return <RequestPage key={`${hub.id}/${request}`} hubId={hub.id} request={request} />;

  return (
    <>
      <TitleRow title={t("menu.approvals")} />
      <PageContent>
        <Stack>
          <Tabs
            items={tabs.map((candidate) => ({
              to: hubPath(hub.id, "approvals", candidate.id),
              label: candidate.id === "pending" && pending ? `${t(candidate.label)} ${pending}` : t(candidate.label),
              current: candidate.id === tab,
            }))}
          />
          <ApprovalRows key={`${hub.id}/${tab}/${requester}`} hubId={hub.id} tab={tab} requester={requester} onPending={setPending} />
        </Stack>
      </PageContent>
    </>
  );
}

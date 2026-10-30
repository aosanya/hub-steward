import { useState } from "react";
import { approveJoinRequest, declineJoinRequest, type DeclineChoice } from "../../data/pages/joinDecisions";
import type { WaitingToJoin } from "../../data/pages/users";
import { useI18n } from "../../i18n";
import { Avatar, Button, Cell, Chip, DataTable, Row, Stack, useNotice } from "../../ui";
import { UsersDecline } from "./usersDecline";

type UsersWaitingProps = { hubId: string; requests: WaitingToJoin[]; onDecided: () => void };

export function UsersWaiting({ hubId, requests, onDecided }: UsersWaitingProps) {
  const { t } = useI18n();
  const { show } = useNotice();
  const [declining, setDeclining] = useState<WaitingToJoin | null>(null);
  const [busy, setBusy] = useState(false);
  const [decided, setDecided] = useState<string[]>([]);
  const waiting = requests.filter((request) => !decided.includes(request.id));
  if (waiting.length === 0) return null;

  const decide = async (request: WaitingToJoin, decision: () => Promise<void>, failure: string) => {
    setBusy(true);
    try {
      await decision();
      setDecided((ids) => [...ids, request.id]);
      setDeclining(null);
    } catch {
      show(failure, "bad");
    }
    setBusy(false);
    onDecided();
  };
  const approve = (request: WaitingToJoin) => decide(request, () => approveJoinRequest(hubId, request.id), t("users.approveFailed"));
  const decline = (request: WaitingToJoin, choice: DeclineChoice) => decide(request, () => declineJoinRequest(hubId, request.id, choice), t("users.declineFailed"));

  const rows = waiting.map((request) => ({
    key: request.id || request.actorId + request.group,
    cells: [
      <Cell text={request.name} lead={<Avatar name={request.name} />} />,
      <Chip>{request.group}</Chip>,
      <Chip kind="warn">{t("waitingForApproval")}</Chip>,
    ],
    actions: (
      <Row>
        <Button size="sm" disabled={busy} onClick={() => approve(request)}>
          {t("approve")}
        </Button>
        <Button kind="quiet" size="sm" disabled={busy} onClick={() => setDeclining(request)}>
          {t("decline")}
        </Button>
      </Row>
    ),
  }));
  return (
    <section aria-label={t("waitingForApproval")}>
      <Stack>
        {declining ? <UsersDecline name={declining.name} group={declining.group} busy={busy} onConfirm={(choice) => decline(declining, choice)} onCancel={() => setDeclining(null)} /> : null}
        <DataTable columns={[t("users.colUser"), t("users.colGroups"), t("users.colState")]} rows={rows} empty={t("noRows")} />
      </Stack>
    </section>
  );
}

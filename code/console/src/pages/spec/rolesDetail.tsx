import { useState, type ReactNode } from "react";
import { proposeRemoveRole, type UsingScenario } from "../../data/pages/roleChange";
import { roleAgents, type RoleAgent } from "../../data/pages/roles";
import type { ActionResult } from "../../data/types";
import { useI18n } from "../../i18n";
import { useTellChat } from "../../shell/chatTell";
import { Button, Card, Detail, Empty, Note, Row, Stack, TextLink } from "../../ui";
import { RemoveRoleAsk, RoleRefusal, roleRefusedText } from "./rolesChange";
import { RoleType, agentEditPath } from "./rolesTable";
import { listOf, textOf } from "./usersRead";
import { rowsOf } from "./usersLoad";
import { useLoaded } from "../../shell/useLoaded";
import { Dash } from "./usersParts";

function RuleLines({ rules }: { rules: Record<string, unknown>[] }) {
  if (rules.length === 0) return <Dash />;
  return (
    <>
      {rules.map((rule, index) => (
        <div key={textOf(rule.id) || index}>
          {textOf(rule.text)} {textOf(rule.code) ? <span className="count">{textOf(rule.code)}</span> : null}
        </div>
      ))}
    </>
  );
}

function AgentLinks({ hubId, agents }: { hubId: string; agents: RoleAgent[] }) {
  if (agents.length === 0) return <Dash />;
  return (
    <Row gap={16}>
      {agents.map((agent) => (
        <TextLink key={agent.id} to={agentEditPath(hubId, agent.id)} arrow size="sm">
          {agent.name}
        </TextLink>
      ))}
    </Row>
  );
}

type RoleDetailProps = {
  hubId: string;
  roleId: string;
  name: string;
  ai: boolean;
  onRemoved: (result: ActionResult) => void;
};

export function RoleDetail({ hubId, roleId, name, ai, onRemoved }: RoleDetailProps) {
  const { t } = useI18n();
  const tellChat = useTellChat();
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [refused, setRefused] = useState<UsingScenario[] | null>(null);
  const { state } = useLoaded(async () => {
    const [rows, agents] = await Promise.all([
      rowsOf("roles", hubId, { role: roleId }),
      roleAgents(hubId, roleId).catch(() => [] as RoleAgent[]),
    ]);
    return { detail: rows[0] ?? {}, agents };
  }, [hubId, roleId]);

  if (state.kind === "loading") return null;
  if (state.kind === "failed") return <Empty text={t("loadFailed")} failed />;

  const { detail, agents } = state.value;
  const description = textOf((detail.role as Record<string, unknown> | null)?.description);
  const begin = () => {
    setRemoving(true);
    setProblem("");
    setRefused(null);
  };
  const remove = async () => {
    setBusy(true);
    setProblem("");
    try {
      const outcome = await proposeRemoveRole(hubId, roleId);
      if (outcome.kind === "refused") {
        setRefused(outcome.scenarios);
        tellChat(roleRefusedText(t, name, outcome.scenarios.length));
        setRemoving(false);
      } else {
        onRemoved(outcome.result);
      }
    } catch {
      setProblem(t("submitFailed"));
    } finally {
      setBusy(false);
    }
  };
  const pairs: [string, ReactNode][] = [
    [t("roles.colType"), <RoleType hubId={hubId} ai={ai} configure={ai && agents.length === 1 ? agentEditPath(hubId, agents[0].id) : undefined} />],
    [t("roles.mayDo"), <RuleLines rules={listOf(detail.rules)} />],
    [t("roles.agents"), <AgentLinks hubId={hubId} agents={agents} />],
  ];
  return (
    <Stack gap={20}>
      {removing ? <RemoveRoleAsk name={name} busy={busy} error={problem} onConfirm={remove} onCancel={() => setRemoving(false)} /> : null}
      {refused ? <RoleRefusal hubId={hubId} name={name} scenarios={refused} /> : null}
      <Card
        title={t("roles.card")}
        actions={
          <Button kind="quiet" size="sm" onClick={begin}>
            {t("roles.remove")}
          </Button>
        }
      >
        {description ? <Note>{description}</Note> : null}
        <Detail pairs={pairs} />
      </Card>
    </Stack>
  );
}

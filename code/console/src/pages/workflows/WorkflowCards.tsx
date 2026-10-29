import { hubPath } from "../../api";
import { useI18n } from "../../i18n";
import { Card, Cell, Chip, Detail, Empty, Row, Stack, TextLink } from "../../ui";
import { Dash } from "../spec/usersParts";
import { textOf } from "../spec/usersRead";
import { ChatMark } from "./ChatMark";
import { MirroringScenarios, RemoveFailed, RemoveWorkflow } from "./WorkflowRemove";
import { WorkflowMenu } from "./WorkflowMenu";
import { useWorkflowRemoval } from "./useWorkflowRemoval";

export const workflowPath = (hubId: string, id: string) => hubPath(hubId, "workflows") + "?open=" + encodeURIComponent(id);

export const idsOf = (value: unknown): string[] => (Array.isArray(value) ? value.map(textOf).filter(Boolean) : []);

export type Codes = Record<string, { code: string; title: string }> | null;

export function ObjectiveLinks({ hubId, ids, codes }: { hubId: string; ids: string[]; codes: Codes }) {
  const { t } = useI18n();
  if (ids.length === 0) return <span className="muted">{t("workflows.noObjective")}</span>;
  return (
    <Stack gap={4}>
      {ids.map((id) => (
        <Row key={id} gap={8}>
          <TextLink to={hubPath(hubId, "goals")} size="sm">
            {codes?.[id]?.code || id}
          </TextLink>
          {codes?.[id]?.title ? <span className="muted">{codes[id].title}</span> : null}
        </Row>
      ))}
    </Stack>
  );
}

const rolesLine = (value: unknown, agency: string): React.ReactNode =>
  Array.isArray(value) && value.length > 0 ? value.map((name) => textOf(name) || agency).join(", ") : <Dash />;

const versionOf = (value: unknown): string => {
  const version = Number(value);
  return version > 0 ? String(version) : "";
};

type WorkflowCardsProps = { hubId: string; rows: Record<string, unknown>[]; codes: Codes; reload: () => void };

export function WorkflowCards({ hubId, rows, codes, reload }: WorkflowCardsProps) {
  const { t } = useI18n();
  const removal = useWorkflowRemoval(hubId, reload);
  if (rows.length === 0) return <Empty text={t("noRows")} />;
  return (
    <Stack gap={12}>
      {removal.asking ? <RemoveWorkflow name={removal.asking.name} busy={removal.busy} onConfirm={removal.confirm} onCancel={removal.cancel} /> : null}
      {removal.failedName ? <RemoveFailed name={removal.failedName} /> : null}
      {removal.refused ? <MirroringScenarios hubId={hubId} refusal={removal.refused} /> : null}
      {rows.map((row) => {
        const id = textOf(row.id);
        const builtIn = row.default === true;
        const version = versionOf(row.version);
        const chats = row.opens_in === "chat";
        const chatsWith: [string, React.ReactNode][] = chats ? [[t("workflows.chatsWith"), textOf(row.chats_with) || <Dash />]] : [];
        const pairs: [string, React.ReactNode][] = builtIn
          ? [[t("workflows.version"), version || <Dash />]]
          : [
              [t("workflows.steps"), String(Number(row.steps) || 0)],
              [t("workflows.roles"), rolesLine(row.roles, t("workflows.agency"))],
              ...chatsWith,
              [t("workflows.objectives"), <ObjectiveLinks hubId={hubId} ids={idsOf(row.objectives)} codes={codes} />],
              [t("workflows.version"), version || <Dash />],
            ];
        return (
          <Card key={builtIn ? textOf(row.code) : id}>
            <Stack gap={12}>
              <div className="workflow-head">
                <Cell text={textOf(row.name)} lead={chats ? <ChatMark /> : undefined} sub={textOf(row.description)} to={builtIn ? undefined : workflowPath(hubId, id)} />
                <Chip kind="mute">{textOf(row.code)}</Chip>
                {builtIn ? <Chip>{t("workflows.builtIn")}</Chip> : null}
                {row.in_use === true ? <Chip kind="ok">{t("workflows.inUse")}</Chip> : null}
                <WorkflowMenu
                  editTo={hubPath(hubId, "workflow-edit", builtIn ? "new" : id, "workflow") + (builtIn ? "?cancel=1" : "")}
                  onRemove={builtIn ? undefined : () => removal.ask({ id, name: textOf(row.name) })}
                />
              </div>
              <Detail pairs={pairs} />
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}

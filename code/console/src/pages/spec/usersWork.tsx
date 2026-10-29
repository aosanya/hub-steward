import { useI18n } from "../../i18n";
import type { UserHold, UserTask } from "../../data/pages/usersDetail";
import { formatWhen } from "../work/formatWhen";
import { Card, Chip, DataTable } from "../../ui";
import { Dash, shortDate } from "./usersParts";

export function TasksCard({ tasks }: { tasks: UserTask[] }) {
  const { t, lang } = useI18n();
  const rows = tasks.map((task) => ({
    key: task.id,
    cells: [task.title, task.status ? <Chip kind="mute">{task.status}</Chip> : <Dash />, task.due ? shortDate(task.due, lang) : <Dash />],
  }));
  return (
    <Card title={t("users.tasks")}>
      <DataTable columns={[t("users.colTask"), t("users.colState"), t("users.colDue")]} rows={rows} empty={t("users.noTasks")} />
    </Card>
  );
}

export function HoldsCard({ holds }: { holds: UserHold[] }) {
  const { t, lang } = useI18n();
  const rows = holds.map((hold) => ({
    key: hold.id,
    cells: [hold.quantity || <Dash />, hold.until ? formatWhen(hold.until, lang) : <Dash />, hold.status ? <Chip kind="mute">{hold.status}</Chip> : <Dash />],
  }));
  return (
    <Card title={t("users.holds")}>
      <DataTable columns={[t("users.colQuantity"), t("users.colUntil"), t("users.colState")]} rows={rows} empty={t("users.noHolds")} />
    </Card>
  );
}

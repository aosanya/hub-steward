import { AddScreen } from "../../AddScreen";
import { assetPaths } from "./paths";

const fields = [{ label: "Title", key: "title", required: true }];

export function WorkOrderNewScreen() {
  return (
    <AddScreen
      title="Add work order"
      backLabel="Work Orders"
      backTo={assetPaths.workOrders.path()}
      permission="task.edit"
      tool="taskmanager_task_create"
      fields={fields}
      build={(sent) => ({ title: String(sent.title ?? "").trim() })}
    />
  );
}

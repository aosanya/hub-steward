import { useParams } from "react-router-dom";
import { callTool } from "../../../../shared/wakala/mcp";
import { FormScreen } from "../../FormScreen";
import { assetPaths } from "./paths";

type Item = Record<string, unknown>;

const fields = [{ label: "Title", key: "title", required: true }];

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const loadOrder = async (id: string): Promise<Item> => {
  const reply = (await callTool("", "taskmanager_task_read", { taskID: id })) as Item | null;
  return (reply?.item as Item | undefined) ?? reply ?? {};
};

export function WorkOrderFormScreen() {
  const { id = "" } = useParams();
  return (
    <FormScreen
      id={id}
      word="work order"
      listLabel="Work Orders"
      addedTo={assetPaths.workOrders.path()}
      editedTo={assetPaths.workOrders.path({ item: id })}
      permission="task.edit"
      load={loadOrder}
      nameOf={(order) => textOf(order.title)}
      addTool="taskmanager_task_create"
      addBuild={(sent) => ({ title: textOf(sent.title).trim() })}
      editTool="taskmanager_task_patch"
      idArg="taskID"
      fields={fields}
    />
  );
}

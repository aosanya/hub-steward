import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { AddScreen } from "../../AddScreen";
import { settingsPaths } from "./paths";

type Level = Record<string, unknown>;

const areaLevelName = async () => {
  const level = (itemsOf(await callTool("", "actor_list_levels")) as Level[]).find((candidate) => candidate.is_area === true);
  return typeof level?.name === "string" ? level.name : "";
};

const fields = [{ label: "Name", key: "name", required: true }];

export function BoundaryNewScreen() {
  const level = useLoad(areaLevelName, `area-level:${openAgencyId()}`);
  const nodeType = level.state === "ready" ? level.data : "";
  return (
    <AddScreen
      title="Add area"
      backLabel="Boundaries & Areas"
      backTo={settingsPaths.boundariesAndAreas.path()}
      permission="group.manage"
      tool="actor_create_group"
      fields={fields}
      check={() => (nodeType === "" ? "This agency has no level for areas yet." : "")}
      build={(sent) => ({ name: String(sent.name ?? "").trim(), node_type: nodeType })}
    />
  );
}

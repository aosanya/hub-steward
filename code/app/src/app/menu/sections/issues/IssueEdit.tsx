import { useState } from "react";
import { useLoad } from "../../../../features/forms/useLoad";
import { useMay } from "../../../../features/agency/useMay";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { MenuEditForm } from "../../MenuEditForm";
import type { IssueRow } from "./issueRow";

export const boardPermission = "board.manage";

const departmentFields = [{ label: "Department", key: "department", required: true }];

const outcomeFields = [{ label: "Outcome", key: "outcome" }];

const currentOutcome = async (boardItemID: string) => {
  try {
    const item = (await callTool("", "forms_catalog_board_item_read", { boardItemID })) as { outcome?: unknown } | null;
    return typeof item?.outcome === "string" ? item.outcome : "";
  } catch {
    return "";
  }
};

function OutcomeEdit({ boardItemId }: { boardItemId: string }) {
  const read = useLoad(() => currentOutcome(boardItemId), `issue-outcome:${openAgencyId()}:${boardItemId}`);
  const [saved, setSaved] = useState<string | null>(null);
  if (read.state !== "ready") return null;
  const outcome = saved ?? read.data;
  return (
    <>
      {outcome ? (
        <Rows>
          <ListRow title="Outcome" meta={outcome} />
        </Rows>
      ) : null}
      <MenuEditForm
        item={{ outcome }}
        id={boardItemId}
        idArg="boardItemID"
        tool="forms_catalog_board_item_set_outcome"
        permission={boardPermission}
        fields={outcomeFields}
        editLabel="Edit outcome"
        onSaved={(changed) => setSaved(changed.outcome ?? outcome)}
      />
    </>
  );
}

function IssueOutcome({ boardItemId }: { boardItemId: string }) {
  const may = useMay(boardPermission);
  return may ? <OutcomeEdit boardItemId={boardItemId} /> : null;
}

export function IssueEdit({ issue }: { issue: IssueRow }) {
  const [department, setDepartment] = useState(issue.department);
  return (
    <>
      <Rows>{department ? <ListRow title="Department" meta={department} /> : null}</Rows>
      <MenuEditForm
        item={{ department }}
        id={issue.id}
        idArg="raisedItemID"
        tool="forms_catalog_raised_item_reassign"
        permission={boardPermission}
        fields={departmentFields}
        editLabel="Edit department"
        onSaved={(changed) => setDepartment(changed.department ?? department)}
      />
      {issue.boardItemId ? <IssueOutcome boardItemId={issue.boardItemId} /> : null}
    </>
  );
}

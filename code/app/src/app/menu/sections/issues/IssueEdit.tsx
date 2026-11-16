import { useState } from "react";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { MenuEditForm } from "../../MenuEditForm";
import type { IssueRow } from "./issueRow";

export const boardPermission = "board.manage";

const departmentFields = [{ label: "Department", key: "department", required: true }];

const outcomeFields = [{ label: "Outcome", key: "outcome" }];

export function IssueEdit({ issue }: { issue: IssueRow }) {
  const [department, setDepartment] = useState(issue.department);
  const [outcome, setOutcome] = useState("");
  return (
    <>
      <Rows>
        {department ? <ListRow title="Department" meta={department} /> : null}
        {outcome ? <ListRow title="Outcome" meta={outcome} /> : null}
      </Rows>
      <MenuEditForm
        item={{ department }}
        id={issue.id}
        idArg="raisedItemID"
        tool="forms_catalog_raised_item_reassign"
        permission={boardPermission}
        fields={departmentFields}
        onSaved={(changed) => setDepartment(changed.department ?? department)}
      />
      {issue.boardItemId ? (
        <MenuEditForm
          item={{ outcome }}
          id={issue.boardItemId}
          idArg="boardItemID"
          tool="forms_catalog_board_item_set_outcome"
          permission={boardPermission}
          fields={outcomeFields}
          onSaved={(changed) => setOutcome(changed.outcome ?? outcome)}
        />
      ) : null}
    </>
  );
}

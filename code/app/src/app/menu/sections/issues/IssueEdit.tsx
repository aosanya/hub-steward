import { useState } from "react";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuEditForm } from "../../MenuEditForm";
import { IssueWish } from "./IssueWish";
import type { IssueRow } from "./issueRow";

export const boardPermission = "board.manage";

export const departmentFields = [{ label: "Department", key: "department", required: true }];

export const outcomeFields = [{ label: "Outcome", key: "outcome" }];

export const currentOutcome = async (boardItemID: string) => {
  try {
    const item = (await callTool("", "forms_catalog_board_item_read", { boardItemID })) as { outcome?: unknown } | null;
    return typeof item?.outcome === "string" ? item.outcome : "";
  } catch {
    return "";
  }
};

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
      <IssueWish issue={issue} />
    </>
  );
}

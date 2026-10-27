import { Empty } from "./Empty";
import type { DataTableProps } from "./props";

export function DataTable({ columns, rows, empty, emptyAction, className }: DataTableProps) {
  if (rows.length === 0) return <Empty text={empty} action={emptyAction} />;
  const withActions = rows.some((row) => row.actions !== undefined && row.actions !== null);
  return (
    <div className="panel table-card">
      <table className={["table", className ?? ""].filter(Boolean).join(" ")}>
        <thead>
          <tr>
            {columns.map((column, i) => (
              <th key={i}>{column}</th>
            ))}
            {withActions ? <th className="row-act" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
              {withActions ? <td className="row-act">{row.actions}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

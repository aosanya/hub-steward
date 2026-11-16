import { callTool } from "../../../../shared/wakala/mcp";
import { MenuWindow } from "../../MenuWindow";
import { budgetRow, homeEmpty, listOf, moneyWords, periodWords, text, tools, type Item } from "./financeData";

const loadLines = async () => (await listOf(tools.budgetList)).map(budgetRow);

const loadLine = async (id: string) => {
  const line = (await callTool("", tools.budgetRead, { budgetID: id })) as Item | null;
  return {
    id,
    name: text(line, "name"),
    department: text(line, "department"),
    period: periodWords(text(line, "period_start"), text(line, "period_end")),
    planned: moneyWords(text(line, "planned")),
    spent: moneyWords(text(line, "spent")),
  };
};

export function BudgetScreen() {
  return (
    <MenuWindow
      title="Budget"
      list={{ title: "Budget", tool: tools.budgetList, load: loadLines, fields: { title: "name", meta: "meta" }, empty: homeEmpty("No budget lines yet.") }}
      detail={{ tool: tools.budgetRead, load: loadLine, fields: { Name: "name", Department: "department", Period: "period", Planned: "planned", Spent: "spent" }, status: "status" }}
    />
  );
}

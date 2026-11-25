import { Link, useNavigate } from "react-router-dom";
import { StatusMarks, TagMarks } from "./RuleMarks";
import { rulePath } from "./paths";
import type { Rule } from "./types";
import { columnWords } from "./words";
import "../../../app/home/homeWindow.css";
import "../shared/backlogs.css";

type Props = { rules: Rule[]; state: unknown };

export function RulesTable({ rules, state }: Props) {
  const navigate = useNavigate();
  const open = (rule: Rule) => navigate(rulePath(rule.code), { state });
  return (
    <table className="home-rec rule-table">
      <thead>
        <tr>
          <th>{columnWords.code}</th>
          <th>{columnWords.title}</th>
          <th>{columnWords.status}</th>
          <th>{columnWords.tags}</th>
          <th aria-hidden="true" />
        </tr>
      </thead>
      <tbody>
        {rules.map((rule) => (
          <tr key={rule.code} onClick={(event) => (event.target as HTMLElement).closest("a") === null && open(rule)}>
            <td className="rule-code">
              <span className="issue-code">{rule.code}</span>
            </td>
            <td className="rule-title">
              <Link to={rulePath(rule.code)} state={state} aria-label={`${rule.code} ${rule.title}`}>
                {rule.title}
              </Link>
            </td>
            <td className="rule-status">
              <StatusMarks rule={rule} />
            </td>
            <td className="rule-tags">
              <TagMarks tags={rule.tags} />
            </td>
            <td className="rule-go" aria-hidden="true">
              ›
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

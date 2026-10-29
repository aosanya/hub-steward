import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n";
import { Chip, DataTable, FromChat } from "../../ui";
import type { RuleLine } from "../../data/scenario";
import { testPath } from "./paths";

const kinds = { held: "ok", failed: "bad", untested: "mute" } as const;

const shownBy = (rule: RuleLine, t: (key: string) => string): string => {
  if (rule.status === "failed")
    return t("test.failedIn").replace("{name}", rule.failedIn[0]);
  if (rule.by.length === 1)
    return t("test.shownBy").replace("{name}", rule.by[0]);
  if (rule.by.length > 1)
    return t("test.shownByMany").replace("{n}", String(rule.by.length));
  return t("test.noScenarioTries");
};

export function RulesHeld({
  hubId,
  rules,
}: {
  hubId: string;
  rules: RuleLine[];
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <FromChat
      prompt={t("chat.test.2")}
      onClear={() => navigate(testPath(hubId))}
    >
      <DataTable
        columns={[t("test.colCode"), t("test.colRule"), t("test.colResult")]}
        rows={rules.map((rule) => ({
          key: rule.code,
          cells: [
            <span key="code" className="count">
              {rule.code}
            </span>,
            <div key="rule" className="cell">
              <span className="cell-text">
                <span>{rule.text}</span>
                <span className="cell-sub">{shownBy(rule, t)}</span>
              </span>
            </div>,
            <Chip key="status" kind={kinds[rule.status]}>
              {t("test.rule." + rule.status)}
            </Chip>,
          ],
        }))}
        empty={t("noRows")}
      />
    </FromChat>
  );
}

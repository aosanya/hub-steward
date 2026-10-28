import { useState } from "react";
import { useI18n } from "../i18n";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { initials } from "./marks";
import type { EditCardProps, ListCardProps, ResultCardProps, RowsCardProps } from "./props";
import { MsgButtons } from "./chat/MsgButtons";
import { MsgCard } from "./chat/MsgCard";
import { TextLink } from "./TextLink";

export function ListCard({ title, items, nav }: ListCardProps) {
  const { t } = useI18n();
  return (
    <MsgCard icon="filter" title={title} className="wide">
      <div>
        {items.map((item, i) => (
          <div className="list-row" key={i}>
            <span className="badge">{initials(item.name)}</span>
            <span className="list-text">
              <span className="list-name">{item.name}</span>
              {item.meta ? <span className="list-meta">{item.meta}</span> : null}
            </span>
            {item.chip}
            {item.to ? (
              <TextLink to={item.to} arrow size="sm">
                {t("ui.open")}
              </TextLink>
            ) : null}
          </div>
        ))}
      </div>
      {nav ? <MsgButtons buttons={[nav]} /> : null}
    </MsgCard>
  );
}

export function RowsCard({ title, rows, columns }: RowsCardProps) {
  const { t } = useI18n();
  return (
    <MsgCard icon="clipboard" title={title} className="wide">
      <table className="mini">
        {columns ? (
          <thead>
            <tr>
              <th />
              {columns.map((column, i) => (
                <th key={i}>{column}</th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>{row.kind === "changed" ? <Chip kind="warn">{t("ui.changed")}</Chip> : <Chip kind="ok">{t("ui.new")}</Chip>}</td>
              {row.cells.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </MsgCard>
  );
}

export function ResultCard({ title, rows }: ResultCardProps) {
  return (
    <MsgCard icon="check" stroke={2.6} tone="ok" title={title} className="wide">
      <div>
        {rows.map((row, i) => (
          <div className="list-row" key={i}>
            <span className="list-text">
              {typeof row === "string" ? (
                <span>{row}</span>
              ) : (
                <>
                  <span className="list-meta">{row.label}</span>
                  <span>{row.value}</span>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </MsgCard>
  );
}

export function EditCard({ title, rows, onSave, onCancel }: EditCardProps) {
  const { t } = useI18n();
  const [values, setValues] = useState(() => rows.map((row) => row.value));
  return (
    <MsgCard icon="edit" title={title}>
      <div className="msg-form">
        {rows.map((row, i) => (
          <label className="field" key={i}>
            <span className="field-label">{row.label}</span>
            <span className="control">
              <input
                type="text"
                value={values[i]}
                onChange={(e) => setValues(values.map((value, j) => (j === i ? e.target.value : value)))}
              />
            </span>
          </label>
        ))}
      </div>
      <div className="msg-buttons">
        <Button size="sm" onClick={() => onSave?.(values)}>
          {t("save")}
        </Button>
        <Button kind="quiet" size="sm" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </MsgCard>
  );
}

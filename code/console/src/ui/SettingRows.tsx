import { Card } from "./Card";
import type { SettingRowsProps } from "./props";

export function SettingRows({ rows, title }: SettingRowsProps) {
  const list = (
    <div className="settings">
      {rows.map((row, i) => {
        const label = (
          <>
            {row.label}
            {row.required && (
              <span className="req" aria-hidden="true">
                *
              </span>
            )}
          </>
        );
        return (
          <div className="setting" key={i}>
            {row.htmlFor ? (
              <label className="setting-label" htmlFor={row.htmlFor}>
                {label}
              </label>
            ) : (
              <span className="setting-label">{label}</span>
            )}
            <div className="setting-control">{row.control}</div>
          </div>
        );
      })}
    </div>
  );
  return title ? <Card title={title}>{list}</Card> : list;
}

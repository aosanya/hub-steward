import { useId, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { Rows } from "./ListRow";
import "./section.css";

export const sectionLimit = 3;

type Props = { word: string; rows: ReactNode[]; opens?: () => void; act?: ReactNode; empty?: { words: string; act?: ReactNode }; foot?: ReactNode; full?: boolean; all?: boolean };

export function Section({ word, rows, opens, act, empty, foot, full = false, all = false }: Props) {
  const [expanded, setExpanded] = useState(true);
  const bodyId = useId();
  const count = rows.length;
  if (count === 0 && !empty) return null;
  const showAll = full || all;
  const more = !showAll && count > sectionLimit;
  const shown = showAll ? rows : rows.slice(0, sectionLimit);
  const title = (
    <>
      {word}
      {count > 0 ? <span className="count">{count}</span> : null}
    </>
  );
  const opening = count > 0 && opens && !full;
  return (
    <section className="sec" aria-label={word}>
      <div className="sec-head">
        {full ? <span /> : (
          <h2 className="sec-title">
            {opening ? (
              <button type="button" className="sec-open" onClick={opens}>
                {title}
              </button>
            ) : (
              title
            )}
          </h2>
        )}
        {count > 0 || full ? act : null}
        {full ? null : (
          <button type="button" className="sec-toggle" aria-label={expanded ? "Collapse" : "Expand"} aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded(!expanded)}>
            <Icon name="chevron" />
          </button>
        )}
      </div>
      {expanded ? (
        <div id={bodyId} className="sec-body">
          <Rows>
            {count === 0 && empty ? <div className="row empty-row"><span className="words">{empty.words}</span></div> : shown}
          </Rows>
        </div>
      ) : null}
      {expanded && ((count === 0 && empty?.act) || more || foot) ? (
        <footer className="sec-foot">
          {more ? <button type="button" className="sec-foot-item" onClick={opens}>{`See all ${count}`}</button> : null}
          {count === 0 ? empty?.act : null}
          {foot}
        </footer>
      ) : null}
    </section>
  );
}

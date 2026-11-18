import { useId, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Rows, SectionRows } from "./ListRow";
import { sectionLimit } from "./sectionLimit";
import { useSectionFilter } from "./SectionFilter";
import "./section.css";

export { sectionLimit };

type Props = { word: string; rows: ReactNode[]; opens?: () => void; empty?: { words: string }; foot?: ReactNode; full?: boolean; all?: boolean; icon?: IconName; plain?: boolean };

export function Section({ word, rows, opens, empty, foot, full = false, all = false, icon, plain = false }: Props) {
  const [expanded, setExpanded] = useState(true);
  const bodyId = useId();
  const count = rows.length;
  const filter = useSectionFilter(word, rows, full);
  if (count === 0 && !empty) return null;
  const showAll = full || all || plain;
  const more = !showAll && count > sectionLimit;
  const shown = full ? filter.kept : showAll ? rows : rows.slice(0, sectionLimit);
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
        {full ? null : (
          <button type="button" className="sec-toggle" aria-label={expanded ? "Collapse" : "Expand"} aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded(!expanded)}>
            <Icon name="chevron" />
          </button>
        )}
      </div>
      {expanded ? (
        <div id={bodyId} className="sec-body">
          {filter.tools}
          <SectionRows.Provider value={{ plain, icon }}>
            <Rows>
              {count === 0 && empty ? <div className="row empty-row"><span className="words">{empty.words}</span></div> : shown}
              {filter.noMatch}
            </Rows>
          </SectionRows.Provider>
        </div>
      ) : null}
      {expanded && (more || foot) ? (
        <footer className="sec-foot">
          {more ? <button type="button" className="sec-foot-item" onClick={opens}>{`See all ${count}`}</button> : null}
          {foot}
        </footer>
      ) : null}
    </section>
  );
}

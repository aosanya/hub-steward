import type { ReactNode } from "react";
import { Rows } from "./ListRow";
import "./section.css";

export const sectionLimit = 3;

type Props = { word: string; rows: ReactNode[]; opens?: () => void; act?: ReactNode; empty?: { words: string; act?: ReactNode }; full?: boolean };

export function Section({ word, rows, opens, act, empty, full = false }: Props) {
  const count = rows.length;
  if (count === 0 && !empty) return null;
  const more = !full && count > sectionLimit;
  const shown = full ? rows : rows.slice(0, sectionLimit);
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
                <span className="chev" aria-hidden="true">›</span>
              </button>
            ) : (
              title
            )}
          </h2>
        )}
        {count > 0 || full ? act : null}
      </div>
      <Rows>
        {count === 0 && empty ? <div className="row empty-row"><span className="words">{empty.words}</span></div> : shown}
      </Rows>
      {(count === 0 && empty?.act) || more ? (
        <footer className="sec-foot">
          {more ? <button type="button" className="sec-foot-item" onClick={opens}>{`See all ${count}`}</button> : null}
          {count === 0 ? empty?.act : null}
        </footer>
      ) : null}
    </section>
  );
}

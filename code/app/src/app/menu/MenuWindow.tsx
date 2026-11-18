import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useWide } from "../../shared/ui/useWide";
import { Shell } from "../Shell";
import { MenuDetail } from "./MenuDetail";
import { MenuList } from "./MenuList";
import { useBackToSection } from "./useBackToSection";
import "../../shared/ui/paneWindow.css";
import "./menuWindow.css";

type ListProps = Pick<ComponentProps<typeof MenuList>, "title" | "tool" | "fields" | "empty" | "load" | "end" | "loadingWords" | "failedWords" | "groups" | "opens">;

type DetailProps = Pick<ComponentProps<typeof MenuDetail>, "tool" | "fields" | "status" | "action" | "load" | "extra">;

type Props = { title: string; list: ListProps; detail: DetailProps; above?: ReactNode; below?: ReactNode; headEnd?: ReactNode; detailKey?: string | number; listKey?: string | number; startAt?: string; elsewhere?: (id: string) => boolean; leave?: (id: string) => void };

export function MenuWindow({ title, list, detail, above, below, headEnd, detailKey, listKey, startAt, elsewhere, leave }: Props) {
  const back = useBackToSection();
  const wide = useWide();
  const [chosen, setChosen] = useState(startAt ?? "");
  const [reported, setReported] = useState<string[] | null>(null);
  const elsewhereNow = useRef(elsewhere);
  elsewhereNow.current = elsewhere;
  useEffect(() => {
    if (!wide || !reported || reported.includes(chosen)) return;
    setChosen(reported.find((id) => !elsewhereNow.current?.(id)) ?? "");
  }, [wide, reported, chosen]);
  const clearsChoice = !!chosen && !wide && !(startAt && chosen === startAt);
  const onBack = clearsChoice ? () => setChosen("") : back.onBack;
  const backLabel = clearsChoice ? list.title : back.backLabel;
  const listPane = (
    <section className={wide ? "mw-list wf-tree" : "mw-list"} aria-label={list.title}>
      {above}
      <MenuList key={listKey} {...list} bare selectedId={chosen} onRows={setReported} onChoose={(id) => (elsewhere?.(id) ? leave?.(id) : setChosen(id))} />
      {below}
    </section>
  );
  const detailBody = <MenuDetail key={detailKey} {...detail} title={title} bare id={chosen} />;
  if (wide) {
    return (
      <Shell title={title} onBack={onBack} backLabel={backLabel} headEnd={headEnd} tabless>
        <div className="wf">
          <div className="wf-panes">
            {listPane}
            <section className={chosen ? "mw-detail wf-main" : "wf-main"} aria-label={chosen ? title : undefined}>
              {chosen ? (
                <>
                  <h2 className="wf-head">{title}</h2>
                  <div className="wf-content">{detailBody}</div>
                </>
              ) : null}
            </section>
          </div>
          <footer className="wf-status" aria-label="Status bar" />
        </div>
      </Shell>
    );
  }
  return (
    <Shell title={title} titleUnder onBack={onBack} backLabel={backLabel} headEnd={headEnd}>
      <div className="mw" data-chosen={chosen ? "yes" : "no"}>
        {listPane}
        {chosen ? (
          <section className="mw-detail" aria-label={title}>
            {detailBody}
          </section>
        ) : null}
      </div>
    </Shell>
  );
}

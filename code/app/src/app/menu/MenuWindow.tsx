import { useState, type ComponentProps, type ReactNode } from "react";
import { useWide } from "../../shared/ui/useWide";
import { Shell } from "../Shell";
import { MenuDetail } from "./MenuDetail";
import { MenuList } from "./MenuList";
import { useBackToSection } from "./useBackToSection";
import "../../shared/ui/paneWindow.css";
import "./menuWindow.css";

type ListProps = Pick<ComponentProps<typeof MenuList>, "title" | "tool" | "fields" | "empty" | "load" | "end" | "loadingWords" | "failedWords" | "groups" | "opens">;

type DetailProps = Pick<ComponentProps<typeof MenuDetail>, "tool" | "fields" | "status" | "action" | "load" | "extra">;

type Props = { title: string; list: ListProps; detail: DetailProps; above?: ReactNode; below?: ReactNode; detailKey?: string | number; listKey?: string | number; elsewhere?: (id: string) => boolean };

export function MenuWindow({ title, list, detail, above, below, detailKey, listKey, elsewhere }: Props) {
  const back = useBackToSection();
  const wide = useWide();
  const [chosen, setChosen] = useState("");
  const onBack = chosen ? () => setChosen("") : back.onBack;
  const backLabel = chosen ? list.title : back.backLabel;
  const listPane = (
    <section className={wide ? "mw-list wf-tree" : "mw-list"} aria-label={list.title}>
      {above}
      <MenuList key={listKey} {...list} bare selectedId={chosen} onChoose={(id) => (elsewhere?.(id) ? undefined : setChosen(id))} />
      {below}
    </section>
  );
  const detailBody = <MenuDetail key={detailKey} {...detail} title={title} bare id={chosen} />;
  if (wide) {
    return (
      <Shell title={title} onBack={onBack} backLabel={backLabel} tabless>
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
    <Shell title={title} titleUnder onBack={onBack} backLabel={backLabel}>
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

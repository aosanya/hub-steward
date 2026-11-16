import { useState, type ComponentProps, type ReactNode } from "react";
import { Shell } from "../Shell";
import { MenuDetail } from "./MenuDetail";
import { MenuList } from "./MenuList";
import { useBackToSection } from "./useBackToSection";
import "./menuWindow.css";

type ListProps = Pick<ComponentProps<typeof MenuList>, "title" | "tool" | "fields" | "empty" | "load" | "end" | "loadingWords" | "failedWords" | "groups">;

type DetailProps = Pick<ComponentProps<typeof MenuDetail>, "tool" | "fields" | "status" | "action" | "load">;

type Props = { title: string; list: ListProps; detail: DetailProps; above?: ReactNode; below?: ReactNode };

export function MenuWindow({ title, list, detail, above, below }: Props) {
  const back = useBackToSection();
  const [chosen, setChosen] = useState("");
  const onBack = chosen ? () => setChosen("") : back.onBack;
  const backLabel = chosen ? list.title : back.backLabel;
  return (
    <Shell title={title} titleUnder onBack={onBack} backLabel={backLabel}>
      <div className="mw" data-chosen={chosen ? "yes" : "no"}>
        <section className="mw-list" aria-label={list.title}>
          {above}
          <MenuList {...list} bare selectedId={chosen} onChoose={setChosen} />
          {below}
        </section>
        {chosen ? (
          <section className="mw-detail" aria-label={title}>
            <MenuDetail {...detail} title={title} bare id={chosen} />
          </section>
        ) : null}
      </div>
    </Shell>
  );
}

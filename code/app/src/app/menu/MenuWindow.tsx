import { useState, type ComponentProps } from "react";
import { Shell } from "../Shell";
import { MenuDetail } from "./MenuDetail";
import { MenuList } from "./MenuList";
import { useBackToSection } from "./useBackToSection";
import "./menuWindow.css";

type ListProps = Pick<ComponentProps<typeof MenuList>, "title" | "tool" | "fields" | "empty">;

type DetailProps = Pick<ComponentProps<typeof MenuDetail>, "tool" | "fields" | "status" | "action">;

type Props = { title: string; list: ListProps; detail: DetailProps };

export function MenuWindow({ title, list, detail }: Props) {
  const back = useBackToSection();
  const [chosen, setChosen] = useState("");
  const onBack = chosen ? () => setChosen("") : back.onBack;
  const backLabel = chosen ? list.title : back.backLabel;
  return (
    <Shell title={title} titleUnder onBack={onBack} backLabel={backLabel}>
      <div className="mw" data-chosen={chosen ? "yes" : "no"}>
        <section className="mw-list" aria-label={list.title}>
          <MenuList {...list} bare selectedId={chosen} onChoose={setChosen} />
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

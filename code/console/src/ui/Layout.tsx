import type { CSSProperties } from "react";
import type { GridProps, NoteProps, RowProps, SectionTitleProps, StackProps, TwoColProps } from "./props";

type Vars = CSSProperties & Record<`--${string}`, string>;

export const stackStyle = (gap: number): Vars | undefined => (gap === 16 ? undefined : { "--stack-gap": `${gap}px` });

export function Stack({ gap = 16, children }: StackProps) {
  return (
    <div className="stack" style={stackStyle(gap)}>
      {children}
    </div>
  );
}

export function Row({ gap = 12, children }: RowProps) {
  const style: Vars | undefined = gap === 12 ? undefined : { "--row-gap": `${gap}px` };
  return (
    <div className="row" style={style}>
      {children}
    </div>
  );
}

export function Grid({ min = 16, gap = 20, children }: GridProps) {
  const style: Vars = { "--grid-min": `${min}rem` };
  if (gap !== 20) style["--grid-gap"] = `${gap}px`;
  return (
    <div className="grid" style={style}>
      {children}
    </div>
  );
}

export function TwoCol({ ratio = "2fr 1fr", left, right }: TwoColProps) {
  const column: Vars = { "--stack-gap": "24px" };
  return (
    <div className="two-col" style={{ "--cols": ratio } as Vars}>
      <div className="stack" style={column}>
        {left}
      </div>
      <div className="stack" style={column}>
        {right}
      </div>
    </div>
  );
}

export function SectionTitle({ title, right }: SectionTitleProps) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {right}
    </div>
  );
}

export function Note({ children }: NoteProps) {
  return <div className="note">{children}</div>;
}

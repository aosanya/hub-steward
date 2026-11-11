import type { ReactNode } from "react";

type Props = { title?: string; sub?: string; end?: ReactNode };

export function ScreenHead({ title, sub, end }: Props) {
  if (!title && !sub) return null;
  const headline = title ? <h1 className="headline">{title}</h1> : null;
  return (
    <div className="head">
      {headline && end ? (
        <div className="head-line">
          {headline}
          {end}
        </div>
      ) : (
        headline
      )}
      {sub ? <p className="sub">{sub}</p> : null}
    </div>
  );
}

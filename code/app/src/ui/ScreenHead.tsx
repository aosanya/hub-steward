type Props = { title?: string; sub?: string };

export function ScreenHead({ title, sub }: Props) {
  if (!title && !sub) return null;
  return (
    <div className="head">
      {title ? <h1 className="headline">{title}</h1> : null}
      {sub ? <p className="sub">{sub}</p> : null}
    </div>
  );
}

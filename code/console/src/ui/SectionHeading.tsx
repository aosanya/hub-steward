import { Button } from "./Button";
import { Chip } from "./Chip";
import { TextLink } from "./TextLink";
import type { SectionEnd, SectionHeadingProps } from "./props";

function End({ item }: { item: SectionEnd }) {
  if (item.kind === "tag") return <Chip kind={item.tone}>{item.text}</Chip>;
  if (item.kind === "text") return <span className="muted">{item.text}</span>;
  if (item.kind === "link")
    return (
      <TextLink to={item.to} arrow size="sm">
        {item.label}
      </TextLink>
    );
  return (
    <Button kind="quiet" size="xs" disabled={item.disabled} onClick={item.onClick}>
      {item.label}
    </Button>
  );
}

export function SectionHeading({ id, title, count, end, note }: SectionHeadingProps) {
  return (
    <div className="section-head">
      <h2 id={id}>{title}</h2>
      {count === undefined ? null : <span className="count">{count}</span>}
      {end ? <End item={end} /> : null}
      {note ? <p className="section-note">{note}</p> : null}
    </div>
  );
}

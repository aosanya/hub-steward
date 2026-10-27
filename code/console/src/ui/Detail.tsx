import { Fragment } from "react";
import { Card } from "./Card";
import type { DetailProps } from "./props";

export function Detail({ pairs, title, actions }: DetailProps) {
  const list = (
    <dl className="kv">
      {pairs.map(([term, description], i) => (
        <Fragment key={i}>
          <dt>{term}</dt>
          <dd>{description}</dd>
        </Fragment>
      ))}
    </dl>
  );
  return title || actions ? (
    <Card title={title} actions={actions}>
      {list}
    </Card>
  ) : (
    list
  );
}

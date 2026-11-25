import type { ReactNode } from "react";
import { Card } from "../../../shared/ui/Card";
import { Rows } from "../../../shared/ui/ListRow";

type Props = { title: string; children: ReactNode; defaultOpen?: boolean };

export function LinkedCard({ title, children, defaultOpen = true }: Props) {
  return (
    <Card title={title} collapsible defaultOpen={defaultOpen} flush>
      <Rows>{children}</Rows>
    </Card>
  );
}

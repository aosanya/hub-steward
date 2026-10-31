import { useState } from "react";
import type { Finding } from "../../data/reviewApi";
import { Card, Cell } from "../../ui";
import { FateChip } from "./FateChip";
import { FindingActions } from "./FindingActions";

export function FindingRow({
  hubId,
  finding,
  onFinding,
  area,
}: {
  hubId: string;
  finding: Finding;
  onFinding: (finding: Finding) => void;
  area?: string;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card title={finding.title} open={expanded} onToggle={() => setExpanded((now) => !now)} className="finding">
      {finding.detail ? <Cell text={finding.detail} strong={false} /> : null}
      <FateChip finding={finding} />
      <FindingActions hubId={hubId} finding={finding} onFinding={onFinding} area={area} />
    </Card>
  );
}

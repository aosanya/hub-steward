import type { Finding } from "../../data/reviewApi";
import { SuggestionDetails } from "../suggestions/SuggestionDetails";

export function FindingDetails({ hubId, finding }: { hubId: string; finding: Finding }) {
  return (
    <SuggestionDetails
      hubId={hubId}
      suggestion={{
        title: finding.title,
        detail: finding.detail,
        tool: finding.tool,
        arguments: finding.arguments,
        then: finding.then,
      }}
    />
  );
}

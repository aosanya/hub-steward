import { agencyReads, type PageChat } from "./types";

const partChat = (kind: string, linkKind: string | null): PageChat => {
  const writes = [
    `agency_create_${kind}`,
    `agency_update_${kind}`,
    ...(linkKind ? [`agency_create_risk_${linkKind}`] : []),
  ];
  return {
    reads: [
      ...agencyReads,
      `agency_list_${kind}s`,
      "agency_list_controls",
      "agency_list_risks",
      ...(linkKind ? [`agency_list_risk_${linkKind}s`, "agency_list_unguarded_parts"] : []),
    ],
    writes,
    suggests: [
      ...writes,
      `agency_delete_${kind}`,
      ...(linkKind ? [`agency_delete_risk_${linkKind}`] : []),
    ],
  };
};

export const hazardsChat = partChat("hazard", null);
export const threatsChat = partChat("threat", "threat");
export const consequencesChat = partChat("consequence", "consequence");

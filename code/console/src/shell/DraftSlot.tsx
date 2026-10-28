import { useSearchParams } from "react-router-dom";
import { showsDraftBar } from "../data/draft";
import { DraftBar } from "../ui/DraftBar";
import type { DraftApi } from "./useDraft";

type DraftSlotProps = { hubId: string; page: string; draft: DraftApi };

export function DraftSlot({ hubId, page, draft }: DraftSlotProps) {
  const [params] = useSearchParams();
  if (!showsDraftBar(page) || draft.state === "none" || params.has("add")) return null;
  return (
    <div className="content draft-slot">
      <DraftBar
        hubId={hubId}
        state={draft.state}
        changes={draft.changes}
        problems={draft.problems}
        version={draft.version}
        onPublish={draft.publish}
      />
    </div>
  );
}

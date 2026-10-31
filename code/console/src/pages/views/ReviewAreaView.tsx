import { areaOfPage } from "../../data/reviewApi";
import { kindOf } from "../../data/hubKind";
import { useConsole } from "../../shell/context";
import { ReviewPageView } from "../review/ReviewPageView";

export function ReviewAreaView() {
  const { hub, page } = useConsole();
  return (
    <ReviewPageView
      key={hub.id + page}
      hubId={hub.id}
      kind={kindOf(hub)}
      area={areaOfPage(page)}
    />
  );
}

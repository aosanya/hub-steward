import { kindOf } from "../../data/hubKind";
import { useConsole } from "../../shell/context";
import { ReviewPageView } from "../review/ReviewPageView";

export function PublishReviewView() {
  const { hub } = useConsole();
  return <ReviewPageView key={hub.id} hubId={hub.id} kind={kindOf(hub)} />;
}

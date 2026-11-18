import { useParams } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { MenuDetail } from "../../MenuDetail";
import { tenureDetail } from "./tenureDetail";

export function HoldingPage() {
  const { tenureId } = useParams();
  const word = useWord("digitaltwin");
  return <MenuDetail title={word("Holding")} id={tenureId} {...tenureDetail} />;
}

import { Button } from "../../shared/ui/Button";
import { tryAgainWords } from "../../shared/ui/LoadState";
import { retryMay, useMayFailed } from "./mayStore";

export const mayFailedWords = "Could not check what you may do.";

export function MayFailedLine() {
  if (!useMayFailed()) return null;
  return (
    <p className="quiet-line" role="status">
      {mayFailedWords} <Button kind="quiet" onClick={retryMay}>{tryAgainWords}</Button>
    </p>
  );
}

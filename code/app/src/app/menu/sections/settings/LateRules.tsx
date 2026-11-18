import { useNavigate } from "react-router-dom";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { Shell } from "../../../Shell";
import { loadFailedWords } from "../../MenuDetail";
import { PageFrame } from "../../PageFrame";
import { useBackToSection } from "../../useBackToSection";
import { ruleWords } from "./lateRulesData";
import { settingsPaths } from "./paths";
import { useLateRules } from "./useLateRules";
import { useOwner } from "./useOwner";

const title = "Late rules";

const line = "How many days after the due date a charge counts as late, and who is reminded.";

export function LateRules() {
  const back = useBackToSection();
  const navigate = useNavigate();
  const owner = useOwner();
  const { view, retry } = useLateRules("late-rules");
  const edit = owner ? (
    <button type="button" className="sec-act" onClick={() => navigate(settingsPaths.lateRulesEdit.path())}>Edit late rules</button>
  ) : undefined;
  return (
    <Shell title={title} onBack={back.onBack} backLabel={back.backLabel}>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words={loadFailedWords} onRetry={retry} /> : null}
      {view.state === "ready" ? (
        <PageFrame title={title} line={line}>
          <Section
            word="Charges"
            plain
            rows={view.data.charges.map((charge) => <ListRow key={charge.id} title={charge.name} meta={ruleWords(charge, view.data.kinds)} />)}
            empty={{ words: "No kinds of charge yet." }}
            foot={edit}
          />
        </PageFrame>
      ) : null}
    </Shell>
  );
}

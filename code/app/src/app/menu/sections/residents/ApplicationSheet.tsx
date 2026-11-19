import { useState } from "react";
import { liveClient } from "../../../../features/forms/api";
import { filled, given, toAnswers, type Draft } from "../../../../features/forms/answers";
import { QuestionInput } from "../../../../features/forms/QuestionInput";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { Sheet } from "../../../../shared/ui/Sheet";
import { callTool, McpError } from "../../../../shared/wakala/mcp";
import { audienceWords } from "../../../../shared/wakala/audienceWords";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { refusalWords } from "../../MenuEditForm";

type Props = { title: string; formId: string; personId: string; personName: string; onClose: () => void; onFiled: () => void };

export function ApplicationSheet({ title, formId, personId, personName, onClose, onFiled }: Props) {
  const view = useLoad(() => liveClient.questions(formId), `application-questions:${openAgencyId()}:${formId}`);
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const file = async (answers: ReturnType<typeof toAnswers>) => {
    setSaving(true);
    setRefused("");
    try {
      await callTool("", "forms_submission_file", { form_id: formId, member_id: personId, channel: "paper", answers });
      onClose();
      onFiled();
    } catch (error) {
      setRefused((error instanceof McpError && audienceWords(error.message, personName)) || refusalWords(error));
      setSaving(false);
    }
  };
  return (
    <Sheet title={title} onClose={onClose}>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words="The questions could not be loaded." /> : null}
      {view.state === "ready" ? (
        <>
          {view.data.map((q) => (
            <QuestionInput key={q.id} q={q} value={given(q, draft)} onChange={(patch) => setDraft((was) => ({ ...was, [q.id]: { ...given(q, was), ...patch } }))} />
          ))}
          {refused ? <LoadFailed words={refused} /> : null}
          <Button kind="primary" disabled={saving || view.data.some((q) => q.required && !filled(q, draft))} onClick={() => file(toAnswers(view.data, draft))}>
            File application
          </Button>
        </>
      ) : null}
    </Sheet>
  );
}

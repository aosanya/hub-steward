import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { useNotice } from "../../ui";

type Save<P> = (hubId: string, role: string, payload: P) => Promise<void>;

export function useAgentSave<P>(role: string, run: Save<P>) {
  const { hub } = useConsole();
  const { t } = useI18n();
  const { show } = useNotice();

  const reportFailure = () => show(t("submitFailed"), "bad");

  const save = async (payload: P) => {
    const ok = await run(hub.id, role, payload).then(
      () => true,
      () => false,
    );
    if (ok) show(t("notice.agentSaved"));
    else reportFailure();
  };

  return { save, reportFailure };
}

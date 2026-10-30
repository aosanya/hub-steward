import type { Suggestion } from "../../data/chatAnswer";
import { loadDetails } from "../../data/chatSuggestionDetails";
import { useI18n } from "../../i18n";
import type { ReactNode } from "react";
import { Card, Detail, Empty, Note, Stack } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";
import { PageContent } from "../work/PageContent";

const kindKey = { goal: "goals.goal", objective: "goals.objective", role: "roles.card" } as const;

export function SuggestionDetails({ hubId, suggestion, actions }: { hubId: string; suggestion: Suggestion; actions?: ReactNode }) {
  const { t } = useI18n();
  const { state } = useLoaded(() => loadDetails(hubId, suggestion), [hubId]);
  const said = [suggestion.title, suggestion.detail].filter(Boolean).join(" — ");
  const hasCards = state.kind === "ready" && state.value.length > 0;

  const body = () => {
    if (state.kind === "loading") return null;
    if (state.kind === "failed") return <Empty text={t("loadFailed")} failed />;
    if (state.value.length === 0) return <Empty text={t("suggest.noDetails")} />;
    return (
      <Stack gap={20}>
        {state.value.map((card, at) => (
          <Card key={`${card.kind}-${card.code}-${card.title}`} className={actions && at === state.value.length - 1 ? "finding" : undefined}>
            {at === 0 ? <div className="lead"><b>{t("suggest.issue")}:</b> {said}</div> : null}
            <h3 className="section-head">{t("suggest.detailsOf").replace("{kind}", t(kindKey[card.kind]))}</h3>
            <Detail
              pairs={[
                [t(kindKey[card.kind]), [card.code, card.title].filter(Boolean).join(" · ")],
                [t("suggest.description"), card.description || "—"],
                ...(card.kind === "role" ? [[t("suggest.permissions"), card.permissions.join(", ") || "—"] as [string, string]] : []),
                ...(card.kind === "objective" ? [[t("goals.goal"), card.goal || "—"] as [string, string]] : []),
              ]}
            />
            {actions && at === state.value.length - 1 ? actions : null}
          </Card>
        ))}
      </Stack>
    );
  };

  return (
    <PageContent>
      {hasCards ? null : <Note>{said}</Note>}
      {body()}
      {actions && state.kind !== "loading" && !hasCards ? <Card className="finding">{actions}</Card> : null}
    </PageContent>
  );
}

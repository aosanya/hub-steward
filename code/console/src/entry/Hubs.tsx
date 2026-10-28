import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hubPath } from "../api";
import { kindOf, stateOf, type HubKind } from "../data/hubKind";
import { useI18n } from "../i18n";
import { useSession } from "../session";
import type { Hub } from "../types";
import { AddTile, Button, ButtonLink, Card, Chip, Detail, Empty, Glyph, Grid, Loading, Row } from "../ui";
import { checkSession, listHubs } from "../wakala/rest";
import { EntryScreen } from "./EntryScreen";
import { ErrorLine } from "./ErrorLine";
import { hubWithState, useHubStates } from "./useHubStates";

type Loaded = "loading" | "failed" | Hub[];

const kindIcons: Record<HubKind, string> = { lab: "laptop", farmers: "wheat", riders: "bike" };

function HubCard({ hub }: { hub: Hub }) {
  const { t } = useI18n();
  const ready = stateOf(hub) === "ready";
  return (
    <Card>
      <div className="ent-hub-head">
        <Glyph name={hub.kind ? kindIcons[kindOf(hub)] : "people"} />
        <div className="ent-hub-name">
          <h3>{hub.name}</h3>
          <Row gap={6}>
            <Chip kind={ready ? "ok" : "warn"}>{ready ? t("hubReady") : t("hubSettingUp")}</Chip>
            {hub.kind ? <Chip kind="mute">{t("hubKind." + kindOf(hub))}</Chip> : null}
          </Row>
        </div>
      </div>
      <Detail
        pairs={[
          [t("hubsRole"), hub.role],
          [t("modelKey"), ready ? t("modelKeySet") : t("modelKeyNotSet")],
        ]}
      />
      <ButtonLink to={hubPath(hub.id, "status")} kind="quiet" size="sm" icon="arrow" wide>
        {t("hubOpen")}
      </ButtonLink>
    </Card>
  );
}

export function Hubs() {
  const { t } = useI18n();
  const { startSession, signOut } = useSession();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<Loaded>("loading");
  const [round, setRound] = useState(0);
  const states = useHubStates(Array.isArray(loaded) ? loaded : []);

  useEffect(() => {
    let current = true;
    const load = async () => {
      const session = await checkSession().catch(() => null);
      if (!current) return;
      if (!session?.ok) return navigate("/start", { replace: true });
      const hubs = await listHubs().catch(() => null);
      if (!current) return;
      if (!hubs) return setLoaded("failed");
      startSession(hubs);
      setLoaded(hubs);
    };
    setLoaded("loading");
    load();
    return () => {
      current = false;
    };
  }, [round, navigate, startSession]);

  const leave = () => {
    signOut()
      .catch(() => {})
      .finally(() => navigate("/start"));
  };

  const body = () => {
    if (loaded === "loading") return <Loading />;
    if (loaded === "failed") {
      return (
        <Card>
          <ErrorLine>{t("loadFailed")}</ErrorLine>
          <Row>
            <Button kind="quiet" onClick={() => setRound((n) => n + 1)}>
              {t("retry")}
            </Button>
          </Row>
        </Card>
      );
    }
    if (loaded.length === 0) {
      return (
        <Empty
          text={t("hubsNone")}
          action={
            <ButtonLink to="/create" icon="plus">
              {t("hubsCreate")}
            </ButtonLink>
          }
        />
      );
    }
    return (
      <Grid min={16}>
        {loaded.map((hub) => (
          <HubCard key={hub.id} hub={hubWithState(hub, states)} />
        ))}
        <AddTile text={t("hubNew")} to="/create" />
      </Grid>
    );
  };

  return (
    <EntryScreen onSignOut={leave}>
      <div className="ent-list">
        <h1>{t("hubYours")}</h1>
        {body()}
      </div>
    </EntryScreen>
  );
}

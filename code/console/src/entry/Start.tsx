import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { Button, Card, Row } from "../ui";
import { EntryScreen } from "./EntryScreen";

export function Start() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <EntryScreen>
      <Card className="ent-card ent-start">
        <h1 className="ent-headline">{t("headline")}</h1>
        <Row>
          <Button onClick={() => navigate("/create")}>{t("create")}</Button>
          <Button kind="quiet" onClick={() => navigate("/login")}>
            {t("logIn")}
          </Button>
        </Row>
      </Card>
    </EntryScreen>
  );
}

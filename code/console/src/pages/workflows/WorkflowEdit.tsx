import { useEffect, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { hubPath } from "../../api";
import { applyWorkflowFill, workflowFillIn } from "../../data/chatFill";
import {
  limitProblem,
  loadDesign,
  saveDesign,
  type Design,
  type WorkflowDraft,
} from "../../data/pages/workflowDesign";
import { useI18n } from "../../i18n";
import { useChipWords } from "../../shell/chipWords";
import { useConsole } from "../../shell/context";
import {
  Button,
  Empty,
  Field,
  Labelled,
  Loading,
  Stack,
  Tabs,
  TitleRow,
  useNotice,
  TextareaControl,
} from "../../ui";
import { TextLabelled } from "./editParts";
import { RecordsTab } from "./RecordsTab";
import { StepsTab } from "./StepsTab";
import "./workflowEdit.css";

const tabs = ["workflow", "steps", "records"] as const;

type TabId = (typeof tabs)[number];

const tabOf = (value: string | undefined): TabId =>
  tabs.find((tab) => tab === value) ?? "workflow";

type Loaded =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "ready"; design: Design };

function WorkflowEditor({
  workflowId,
  current,
}: {
  workflowId: string | null;
  current: TabId;
}) {
  const { hub } = useConsole();
  const { t } = useI18n();
  const { show } = useNotice();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const carried = workflowFillIn(useLocation().state);
  const asked = workflowId === null ? carried : null;
  const cancelKind = params.get("cancel") !== null;
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  const [original, setOriginal] = useState<WorkflowDraft | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowDraft | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    loadDesign(hub.id, workflowId).then(
      (design) => {
        if (!live) return;
        setLoaded({ kind: "ready", design });
        setOriginal(design.workflow);
        const start = asked
          ? applyWorkflowFill(design.workflow, asked, design.choices.roles)
          : design.workflow;
        setWorkflow(
          cancelKind && workflowId === null
            ? { ...start, cancelsOrder: true }
            : start,
        );
      },
      () => live && setLoaded({ kind: "failed" }),
    );
    return () => {
      live = false;
    };
  }, [hub.id, workflowId]);

  useChipWords(workflow?.steps.at(-1)?.name.trim() || undefined);

  const listPath = hubPath(hub.id, "workflows");
  const title = workflowId
    ? t("workflows.edit")
    : t(cancelKind ? "workflows.addCancel" : "workflows.add");

  if (loaded.kind === "failed") return <Empty text={t("loadFailed")} failed />;
  if (loaded.kind === "loading" || !workflow || !original) return <Loading />;
  const { design } = loaded;
  const change = (next: Partial<WorkflowDraft>) =>
    setWorkflow({ ...workflow, ...next });

  const save = async () => {
    const problem = limitProblem(workflow.steps);
    if (problem) {
      setError(
        t(
          problem === "number"
            ? "workflows.limitNumber"
            : "workflows.limitWorkflow",
        ),
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveDesign(hub.id, original, workflow);
      show(t("workflows.saved"));
      navigate(listPath);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("submitFailed"));
    } finally {
      setBusy(false);
    }
  };

  const base = hubPath(hub.id, "workflow-edit", workflowId ?? "new");
  const search = cancelKind ? "?cancel=1" : "";

  return (
    <>
      <TitleRow title={title} />
      <div className="content">
        <Stack gap={20}>
          <Tabs
            items={tabs.map((tab) => ({
              to: `${base}/${tab}${search}`,
              label: t(
                tab === "workflow"
                  ? "workflows.card"
                  : tab === "steps"
                    ? "workflows.steps"
                    : "workflows.records",
              ),
              current: tab === current,
            }))}
          />
          {current === "workflow" ? (
            <Stack gap={18}>
              <TextLabelled
                id="workflow-name"
                label={t("field.name")}
                value={workflow.name}
                onChange={(name) => change({ name })}
              />
              <Labelled
                id="workflow-description"
                label={t("workflows.forWhat")}
                required={false}
              >
                <TextareaControl
                  id="workflow-description"
                  label={t("workflows.forWhat")}
                  value={workflow.description}
                  onChange={(description) => change({ description })}
                />
              </Labelled>
              <Field
                spec={{
                  name: "opensIn",
                  component: "radios",
                  options: [
                    { value: "chat", label: t("workflows.opensIn.chat") },
                    { value: "form", label: t("workflows.opensIn.form") },
                  ],
                }}
                value={workflow.opensIn}
                disabled={
                  workflow.ordersUnderWay > 0 ||
                  workflow.steps.some((step) => step.kind === "chat")
                }
                onChange={(opensIn) =>
                  change({ opensIn: opensIn === "chat" ? "chat" : "form" })
                }
              />
              <Field
                spec={{ name: "cancelsOrder", component: "toggle" }}
                value={workflow.cancelsOrder}
                onChange={(cancelsOrder) =>
                  change({ cancelsOrder: cancelsOrder === true })
                }
              />
            </Stack>
          ) : null}
          {current === "steps" ? (
            <StepsTab
              workflow={workflow}
              choices={design.choices}
              onChange={(steps) => change({ steps })}
            />
          ) : null}
          {current === "records" ? (
            <RecordsTab
              records={workflow.records}
              choices={design.choices}
              onChange={(records) => change({ records })}
            />
          ) : null}
          {error ? (
            <p className="field-error error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="form-foot">
            <Button
              disabled={busy || workflow.name.trim() === ""}
              onClick={save}
            >
              {t("save")}
            </Button>
            <Button kind="quiet" onClick={() => navigate(listPath)}>
              {t("cancel")}
            </Button>
            <span className="muted">{t("workflows.saveHint")}</span>
          </div>
        </Stack>
      </div>
    </>
  );
}

export function WorkflowEdit() {
  const { hub } = useConsole();
  const params = useParams();
  const id = params.id && params.id !== "new" ? params.id : null;
  return (
    <WorkflowEditor
      key={hub.id + "/" + (id ?? "new")}
      workflowId={id}
      current={tabOf(params.tab)}
    />
  );
}

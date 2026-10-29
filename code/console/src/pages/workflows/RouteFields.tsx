import {
  routeOperators,
  type Choice,
  type RouteDraft,
  type RuleDraft,
  type StepDraft,
} from "../../data/pages/workflowDesign";
import { useI18n } from "../../i18n";
import { Button } from "../../ui";
import { PickLabelled, TextLabelled, replaced, without } from "./editParts";

type Props = {
  id: string;
  step: StepDraft;
  sent: StepDraft | undefined;
  steps: Choice[];
  onChange: (next: StepDraft) => void;
  onNewThanks: (apply: (key: string) => StepDraft) => void;
};

const emptyRule = (sent: StepDraft | undefined): RuleDraft => ({
  question: sent?.questions[0]?.prompt ?? "",
  operator: "is",
  value: "",
});

const newThanks = "__new_thanks__";

export function RouteFields({
  id,
  step,
  sent,
  steps,
  onChange,
  onNewThanks,
}: Props) {
  const { t } = useI18n();
  const prompts = (sent?.questions ?? []).map((question) => ({
    value: question.prompt,
    label: question.prompt,
  }));
  const setRoute = (at: number, next: RouteDraft) =>
    onChange({ ...step, routes: replaced(step.routes, at, next) });
  const nextStep = { value: "", label: t("workflows.nextStep") };
  const yesNo = (sent?.questions ?? []).find(
    (question) => question.answerType === "yes_no",
  );
  if (yesNo) {
    const target = (answer: string) =>
      step.routes.find((route) =>
        route.rules.some((rule) => rule.value === answer),
      )?.goTo ?? "";
    const withTarget = (answer: string, goTo: string): StepDraft => {
      const route: RouteDraft = {
        match: "all",
        rules: [{ question: yesNo.prompt, operator: "is", value: answer }],
        goTo,
      };
      const kept = step.routes.filter(
        (existing) => !existing.rules.some((rule) => rule.value === answer),
      );
      return { ...step, routes: [...kept, route] };
    };
    const setTarget = (answer: string, goTo: string) =>
      goTo === newThanks
        ? onNewThanks((key) => withTarget(answer, key))
        : onChange(withTarget(answer, goTo));
    return (
      <>
        {(["yes", "no"] as const).map((answer) => (
          <PickLabelled
            key={answer}
            id={`${id}-${answer}`}
            label={t(answer === "yes" ? "workflows.ifYes" : "workflows.ifNo")}
            value={target(answer)}
            options={[
              nextStep,
              ...steps,
              { value: newThanks, label: t("workflows.newThanks") },
            ]}
            onChange={(goTo) => setTarget(answer, goTo)}
          />
        ))}
      </>
    );
  }
  return (
    <>
      {step.routes.length === 0 ? (
        <p className="muted">{t("workflows.noRoutes")}</p>
      ) : null}
      {step.routes.map((route, at) => (
        <div key={at} className="card tight">
          <PickLabelled
            id={`${id}-r${at}-match`}
            label={t("workflows.match")}
            value={route.match}
            options={[
              { value: "all", label: t("workflows.matchAll") },
              { value: "any", label: t("workflows.matchAny") },
            ]}
            onChange={(match) =>
              setRoute(at, { ...route, match: match === "any" ? "any" : "all" })
            }
          />
          {route.rules.map((rule, index) => (
            <div key={index} className="wf-rule">
              <PickLabelled
                id={`${id}-r${at}-${index}-q`}
                label={t("workflows.question")}
                value={rule.question}
                options={prompts}
                onChange={(question) =>
                  setRoute(at, {
                    ...route,
                    rules: replaced(route.rules, index, { ...rule, question }),
                  })
                }
              />
              <PickLabelled
                id={`${id}-r${at}-${index}-op`}
                label={t("workflows.operator")}
                value={rule.operator}
                options={routeOperators.map((operator) => ({
                  value: operator,
                  label: t("workflows.operator." + operator),
                }))}
                onChange={(operator) =>
                  setRoute(at, {
                    ...route,
                    rules: replaced(route.rules, index, {
                      ...rule,
                      operator: operator as RuleDraft["operator"],
                    }),
                  })
                }
              />
              <TextLabelled
                id={`${id}-r${at}-${index}-v`}
                label={t("workflows.value")}
                value={rule.value}
                onChange={(value) =>
                  setRoute(at, {
                    ...route,
                    rules: replaced(route.rules, index, { ...rule, value }),
                  })
                }
              />
              <Button
                kind="quiet"
                size="xs"
                onClick={() =>
                  setRoute(at, { ...route, rules: without(route.rules, index) })
                }
              >
                {t("workflows.removeRule")}
              </Button>
            </div>
          ))}
          <div>
            <Button
              kind="quiet"
              size="xs"
              onClick={() =>
                setRoute(at, {
                  ...route,
                  rules: [...route.rules, emptyRule(sent)],
                })
              }
            >
              {t("workflows.addRule")}
            </Button>
          </div>
          <PickLabelled
            id={`${id}-r${at}-go`}
            label={t("workflows.thenGoTo")}
            value={route.goTo}
            options={[nextStep, ...steps]}
            onChange={(goTo) => setRoute(at, { ...route, goTo })}
          />
          <Button
            kind="quiet"
            size="xs"
            onClick={() =>
              onChange({ ...step, routes: without(step.routes, at) })
            }
          >
            {t("workflows.removeRoute")}
          </Button>
        </div>
      ))}
      <div>
        <Button
          kind="quiet"
          size="sm"
          onClick={() =>
            onChange({
              ...step,
              routes: [
                ...step.routes,
                { match: "all", rules: [emptyRule(sent)], goTo: "" },
              ],
            })
          }
        >
          {t("workflows.addRoute")}
        </Button>
      </div>
      <PickLabelled
        id={id + "-otherwise"}
        label={t("workflows.otherwise")}
        value={step.otherwiseKey}
        options={[nextStep, ...steps]}
        onChange={(otherwiseKey) => onChange({ ...step, otherwiseKey })}
      />
    </>
  );
}

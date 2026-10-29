import { useI18n } from "../../i18n";
import { Card, Empty, SelectControl, Stack, TextControl } from "../../ui";
import { suggestedEndpoint } from "../../data/blockEndpoint";
import type {
  Block,
  EndpointDraft,
  InputDraft,
  StepToFill,
} from "../../data/scenario";

type Props = {
  steps: StepToFill[];
  inputs: InputDraft[];
  namesFor: (role: string) => string[];
  onChange: (inputs: InputDraft[]) => void;
  blocks?: Block[];
  endpoints?: EndpointDraft[];
  onEndpoints?: (endpoints: EndpointDraft[]) => void;
};

export function BlocksEditor({
  steps,
  inputs,
  namesFor,
  onChange,
  blocks = [],
  endpoints = [],
  onEndpoints,
}: Props) {
  const { t } = useI18n();
  if (steps.length === 0) return <Empty text={t("noRows")} />;
  const valueOf = (stepId: string, field: string) =>
    inputs.find((input) => input.stepId === stepId && input.field === field)
      ?.value ?? "";
  const set = (stepId: string, field: string, value: string) =>
    onChange([
      ...inputs.filter(
        (input) => !(input.stepId === stepId && input.field === field),
      ),
      { stepId, field, value },
    ]);
  const endpointValue = (stepId: string) =>
    endpoints.find((entry) => entry.stepId === stepId)?.endpoint ?? "";
  const setEndpoint = (stepId: string, endpoint: string) =>
    onEndpoints?.([
      ...endpoints.filter((entry) => entry.stepId !== stepId),
      { stepId, endpoint },
    ]);
  return (
    <Stack gap={16}>
      {steps.map((step, index) => (
        <Card
          key={step.id}
          title={
            <>
              <span className="term">{`${t("test.colStep")} ${index + 1}`}</span>
              {` · ${step.title}`}
            </>
          }
        >
          <Stack gap={12}>
            {onEndpoints ? (
              <label className="stack">
                <span>{t("test.endpoint")}</span>
                <TextControl
                  label={t("test.endpoint")}
                  value={endpointValue(step.id)}
                  placeholder={
                    suggestedEndpoint(
                      blocks.find((block) => block.stepId === step.id) ?? {
                        kind: "",
                        title: "",
                        action: "",
                      },
                    ) || t("test.endpointNone")
                  }
                  onChange={(next) => setEndpoint(step.id, next)}
                />
              </label>
            ) : null}
            {step.questions.length === 0 ? (
              <span className="muted">{t("test.noQuestions")}</span>
            ) : null}
            {step.questions.map((question) => {
              const { prompt } = question;
              const options =
                question.options.length > 0
                  ? question.options
                  : question.optionsFrom !== ""
                    ? namesFor(question.optionsFrom)
                    : [];
              const value = valueOf(step.id, prompt);
              return (
                <label key={prompt} className="stack">
                  <span>{prompt}</span>
                  {options.length > 0 ? (
                    <SelectControl
                      label={prompt}
                      value={value}
                      options={[
                        { value: "", label: t("test.random") },
                        ...[...new Set([...options, value])]
                          .filter(Boolean)
                          .map((name) => ({ value: name, label: name })),
                      ]}
                      onChange={(next) => set(step.id, prompt, next)}
                    />
                  ) : (
                    <TextControl
                      label={prompt}
                      value={value}
                      placeholder={t("test.free")}
                      onChange={(next) => set(step.id, prompt, next)}
                    />
                  )}
                </label>
              );
            })}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

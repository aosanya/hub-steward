import { Stack } from "../../ui";
import type { FunctionChoice, FunctionVersions } from "./calcStepApi";
import { FunctionCard } from "./FunctionCard";
import { InputsCard } from "./InputsCard";
import { PostingStepCard } from "./PostingStepCard";
import type { Posting } from "./postingSentence";
import { StepCard, type StepCardValue } from "./StepCard";
import { TryItCard } from "./TryItCard";
import type { SourceKind } from "./sourceFlags";
import type { StepSetup } from "./stepSetup";
import type { InputRow } from "./sourceFlags";

export type CalcStepScreenProps = {
  stepId: string;
  setup: StepSetup;
  functions: FunctionVersions[];
  chosen: FunctionChoice | null;
  inputs: InputRow[];
  step: StepCardValue;
  posting: Posting;
  onFunction: (choice: FunctionChoice) => void;
  onChoose: (input: string, kind: SourceKind | null) => void;
  onFixedValue: (input: string, value: string) => void;
  onStep: (value: StepCardValue) => void;
  onPosting: (value: Posting) => void;
};

export function CalcStepScreen(props: CalcStepScreenProps) {
  const { setup, stepId } = props;
  return (
    <Stack gap={20}>
      <FunctionCard functions={props.functions} chosen={props.chosen} onChange={props.onFunction} />
      <InputsCard rows={props.inputs} onChoose={props.onChoose} onFixedValue={props.onFixedValue} />
      <StepCard stepId={stepId} steps={setup.steps} roles={setup.roles} value={props.step} onChange={props.onStep} />
      <TryItCard inputs={props.inputs.map((row) => row.name)} client={setup.client} />
      <PostingStepCard
        title={setup.postTitle}
        results={setup.results}
        accounts={setup.accounts}
        value={props.posting}
        onChange={props.onPosting}
      />
    </Stack>
  );
}

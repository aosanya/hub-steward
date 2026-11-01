import type { RouteDraft, StepDraft } from "../../data/pages/workflowDesign";

export type Arrival = { from: StepDraft; via: string };

const viaOf = (route: RouteDraft) => {
  const [rule] = route.rules;
  const single = route.rules.length === 1 && rule.operator === "is";
  if (single && rule.value === "yes") return "viaYes";
  if (single && rule.value === "no") return "viaNo";
  return "viaMatch";
};

export const arrivalsAt = (steps: StepDraft[], index: number): Arrival[] => {
  const key = steps[index].key;
  const previous = steps[index - 1];
  const inOrder: Arrival[] =
    previous && previous.kind !== "route"
      ? [{ from: previous, via: "viaOrder" }]
      : previous && previous.otherwiseKey === ""
        ? [{ from: previous, via: "viaOtherwise" }]
        : [];
  const routed = steps.flatMap((from) =>
    from.kind === "route" && from.key !== key
      ? [
          ...from.routes
            .filter((route) => route.goTo === key)
            .map((route) => ({ from, via: viaOf(route) })),
          ...(from.otherwiseKey === key ? [{ from, via: "viaOtherwise" }] : []),
        ]
      : [],
  );
  return [...inOrder, ...routed];
};

import type { ComponentType } from "react";
import { approvalView, formView, listView } from "../data/chatActions";
import { limitRaiseView } from "../data/limitRaise";
import { roleLimitView } from "../data/roleLimitAction";
import { usageAnswerView } from "../data/usageAnswer";
import { LimitRaiseView } from "../pages/limits/LimitRaiseView";
import { RoleLimitsView } from "../pages/limits/RoleLimitsView";
import { UsageAnswerView } from "../pages/usage/UsageAnswerView";
import { ActionApproval } from "./ActionApproval";
import { ActionForm } from "./ActionForm";
import { ActionList } from "./ActionList";

export type ActionViewProps = { hubId: string; title: string; params: Record<string, unknown>; onDone: () => void };

export const actionViews: Record<string, ComponentType<ActionViewProps>> = {
  [formView]: ActionForm,
  [approvalView]: ActionApproval,
  [listView]: ActionList,
  [roleLimitView]: RoleLimitsView,
  [limitRaiseView]: LimitRaiseView,
  [usageAnswerView]: UsageAnswerView,
};

export const actionViewOf = (view: string): ComponentType<ActionViewProps> | null => (Object.hasOwn(actionViews, view) ? actionViews[view] : null);

import { isGroupOrderForm, type StartStep } from "../coordinator/start/api";
import type { InvitationItem, NotificationItem } from "./api";

const waitingEvents = new Set(["ask_waiting", "revision_asked", "draft_waiting", "survey_reached", "form_published", "new_form", "task_assigned"]);

const invitationEvents = new Set(["group_invited", "invited"]);

export const waitingStepsOf = (steps: StartStep[]) => steps.filter((step) => !isGroupOrderForm(step));

export const needsYouNotes = (items: NotificationItem[] | null) => (items ?? []).filter((n) => waitingEvents.has(n.event) && !n.read);

export const updatesOf = (items: NotificationItem[] | null) => (items ?? []).filter((n) => !waitingEvents.has(n.event) && !invitationEvents.has(n.event));

export const newsUnreadIn = (items: NotificationItem[] | null) => updatesOf(items).some((n) => !n.read);

type Waiting = { steps: StartStep[]; invitations: InvitationItem[]; items: NotificationItem[] | null };

export const needsYouCount = ({ steps, invitations, items }: Waiting) => waitingStepsOf(steps).length + invitations.length + needsYouNotes(items).length;

export const waitingNoticesOf = needsYouNotes;

export const needsYouCountOf = ({ steps, invitations, notifications }: { steps: StartStep[]; invitations: InvitationItem[]; notifications: NotificationItem[] | null }) =>
  needsYouCount({ steps, invitations, items: notifications });

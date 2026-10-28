import { callTool } from "../wakala/mcp";

export type NotificationItem = {
  id: string;
  event: string;
  subjectKind: string;
  subjectId: string;
  structureId?: string;
  names: Record<string, string>;
  createdAt: string;
  read: boolean;
};

export type InvitationItem = {
  id: string;
  groupName: string;
  inviterName: string;
  expiresInDays: number;
};

export type InboxClient = {
  listNotifications: () => Promise<NotificationItem[]>;
  markRead: (ids: string[]) => Promise<number>;
  listInvitations: () => Promise<InvitationItem[]>;
  acceptInvitation: (id: string) => Promise<void>;
  declineInvitation: (id: string) => Promise<void>;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

const notificationOf = (raw: any): NotificationItem => ({
  id: text(raw?.id ?? raw?.ID),
  event: text(raw?.event ?? raw?.Event),
  subjectKind: text(raw?.subject_kind ?? raw?.SubjectKind),
  subjectId: text(raw?.subject_id ?? raw?.SubjectID),
  structureId: text(raw?.structure_id ?? raw?.StructureID),
  names: raw?.names ?? raw?.Names ?? {},
  createdAt: text(raw?.created_at ?? raw?.CreatedAt),
  read: Boolean(raw?.read_at ?? raw?.ReadAt),
});

const invitationOf = (raw: any): InvitationItem => ({
  id: text(raw?.id ?? raw?.ID),
  groupName: text(raw?.group_name ?? raw?.structure_name ?? raw?.role_kind_name),
  inviterName: text(raw?.inviter_name ?? raw?.invited_by_name),
  expiresInDays: Number(raw?.expires_in_days ?? 0),
});

export const mcpInboxClient: InboxClient = {
  async listNotifications() {
    const out = await callTool<{ items?: unknown[] }>("", "comm_notification_list", {});
    return (out.items ?? []).map(notificationOf);
  },
  async markRead(ids) {
    const out = await callTool<{ marked?: number }>("", "comm_notification_mark_read", { ids });
    return out.marked ?? 0;
  },
  async listInvitations() {
    const out = await callTool<{ items?: unknown[] }>("", "actor_list_my_invitations", {});
    return (out.items ?? []).map(invitationOf);
  },
  async acceptInvitation(id) {
    await callTool("", "actor_accept_invitation", { invitation_id: id });
  },
  async declineInvitation(id) {
    await callTool("", "actor_decline_invitation", { invitation_id: id });
  },
};

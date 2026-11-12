import { type InboxClient, mcpInboxClient } from "./api";
import { sharedRead } from "./sharedRead";

const useInvitationsRead = sharedRead<Pick<InboxClient, "listInvitations">, Awaited<ReturnType<InboxClient["listInvitations"]>>>((client) => client.listInvitations());

export const useInvitations = (client: Pick<InboxClient, "listInvitations"> = mcpInboxClient) => useInvitationsRead(client);

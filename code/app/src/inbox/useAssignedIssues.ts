import { type AssignedClient, type AssignedIssue, mcpAssignedClient } from "./assignedIssues";
import { sharedRead } from "./sharedRead";

const useAssignedRead = sharedRead<AssignedClient, AssignedIssue[]>((client) => client.assigned());

export const useAssignedIssues = (client: AssignedClient = mcpAssignedClient) => useAssignedRead(client);

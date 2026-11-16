import { openAgencyId } from "../../../shared/wakala/openAgency";
import { useLoad } from "../../../features/forms/useLoad";
import { mcpSendClient } from "./api";
import type { SendClient } from "./types";

export const useTargets = (client: SendClient = mcpSendClient) => useLoad(() => client.targets(), `send-targets:${openAgencyId()}`);

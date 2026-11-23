import { useState } from "react";
import { MenuRows } from "../menu/MenuRows";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { HomeNodeRows } from "./HomeNodeRows";
import { HomeOptions } from "./HomeOptions";
import { NeedsYouStrip } from "./NeedsYouStrip";
import type { HomeNode } from "./homeDeclaration";
import { useHomeFacts, type HomeWiring } from "./homeFacts";
import { homePath } from "./homePaths";
import { shownNodes } from "./homeVisibility";
import { useHomeDeclaration } from "./useHomeDeclaration";
import { mcpAgencyClient } from "../../features/agency/modules";

export const homeHeadWords = "Home";

export const homeFailedWords = "Home could not be loaded.";

export const nothingOnHomeWords = "Nothing to show yet";

function DeclaredRows({ nodes, wiring }: { nodes: HomeNode[]; wiring: HomeWiring }) {
  const [attempt, setAttempt] = useState(0);
  const facts = useHomeFacts(nodes, wiring, attempt);
  if (facts.state === "loading") return <LoadingLine words="Loading your Home" />;
  if (facts.state === "error") return <LoadFailed words={facts.words} onRetry={() => setAttempt(attempt + 1)} />;
  const shown = shownNodes(nodes, facts.data);
  if (shown.length === 0) return <EmptyCard words={nothingOnHomeWords} />;
  return <HomeNodeRows nodes={shown} facts={facts.data} marked from={{ path: homePath(), title: "Home" }} />;
}

export function AgencyHome(wiring: HomeWiring) {
  const [attempt, setAttempt] = useState(0);
  const declaration = useHomeDeclaration(attempt);
  if (declaration.state === "loading") return <><NeedsYouStrip /><LoadingLine words="Loading your Home" /></>;
  if (declaration.state === "error") return <><NeedsYouStrip /><LoadFailed words={homeFailedWords} onRetry={() => setAttempt(attempt + 1)} /></>;
  if (declaration.data.length === 0) return <><NeedsYouStrip /><HomeOptions {...wiring} /><MenuRows agency={wiring.agency ?? mcpAgencyClient} /></>;
  return <><NeedsYouStrip /><DeclaredRows nodes={declaration.data} wiring={wiring} /></>;
}

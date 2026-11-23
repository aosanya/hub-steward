import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import { LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { Shell } from "../Shell";
import { homeTab } from "../tabs";
import { useWide } from "../../shared/ui/useWide";
import { HomeNodeRows } from "./HomeNodeRows";
import { HomeSectionWindow } from "./HomeSectionWindow";
import { splitEntries } from "./homeRowSteps";
import { findNode, pathTo, titleIn, type HomeNode } from "./homeDeclaration";
import { useHomeFacts, type HomeFacts, type HomeWiring } from "./homeFacts";
import { homeLayout, toolsKey } from "./homeLayout";
import { homePath, homeSectionPath } from "./homePaths";
import { homeFailedWords } from "./AgencyHome";
import { shownNodes } from "./homeVisibility";
import { useHomeDeclaration } from "./useHomeDeclaration";

type Loaded = { declared: HomeNode[]; facts: HomeFacts };

function SectionBody({ sectionKey, loaded }: { sectionKey: string; loaded: Loaded }) {
  const navigate = useNavigate();
  const { code, words } = useLanguage();
  const wide = useWide();
  const section = findNode(shownNodes(loaded.declared, loaded.facts), sectionKey);
  if (!section || section.target) return <Navigate to={homePath()} replace />;
  const trail = pathTo(shownNodes(loaded.declared, loaded.facts), sectionKey);
  if (wide) {
    return <HomeSectionWindow root={trail[0]} facts={loaded.facts} selectedKey={sectionKey} opened={trail.slice(1).map((node) => node.key)} />;
  }
  const { plain, workflows } = splitEntries(section.entries, loaded.facts);
  const ancestors = pathTo(loaded.declared, sectionKey).slice(0, -1);
  const parent = ancestors.at(-1);
  const here = { path: homeSectionPath(section.key), title: titleIn(section, code) };
  return (
    <Shell title={titleIn(section, code)} onBack={() => navigate(parent ? homeSectionPath(parent.key) : homePath())} backLabel={parent ? titleIn(parent, code) : homeTab.label}>
      <HomeNodeRows nodes={plain} facts={loaded.facts} from={here} />
      {workflows.length > 0 ? (
        <>
          <h2>{words.homeWorkflows}</h2>
          <HomeNodeRows nodes={workflows} facts={loaded.facts} from={here} />
        </>
      ) : null}
    </Shell>
  );
}

function SectionFacts({ sectionKey, declared, wiring }: { sectionKey: string; declared: HomeNode[]; wiring: HomeWiring }) {
  const [attempt, setAttempt] = useState(0);
  const facts = useHomeFacts(declared, wiring, attempt);
  if (facts.state === "loading") return <Shell title={homeTab.label}><LoadingLine words="Loading" /></Shell>;
  if (facts.state === "error") return <Shell title={homeTab.label}><LoadFailed words={facts.words} onRetry={() => setAttempt(attempt + 1)} /></Shell>;
  return <SectionBody sectionKey={sectionKey} loaded={{ declared, facts: facts.data }} />;
}

export function HomeSectionPage(wiring: HomeWiring) {
  const { key = "" } = useParams();
  const [attempt, setAttempt] = useState(0);
  const declaration = useHomeDeclaration(attempt);
  if (declaration.state === "loading") return <Shell title={homeTab.label}><LoadingLine words="Loading" /></Shell>;
  if (declaration.state === "error") return <Shell title={homeTab.label}><LoadFailed words={homeFailedWords} onRetry={() => setAttempt(attempt + 1)} /></Shell>;
  if (declaration.data.length === 0 && key !== toolsKey) return <Navigate to={homePath()} replace />;
  return <SectionFacts sectionKey={key} declared={homeLayout(declaration.data)} wiring={wiring} />;
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell } from "../../app/Shell";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { agencyHomePath, openAgencyId } from "../../shared/wakala/openAgency";
import { useLoad } from "../forms/useLoad";
import { listOpenPolls } from "./api";
import { OpenQuestion } from "./OpenQuestion";

export function QuestionScreen() {
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const polls = useLoad(listOpenPolls, `question:${openAgencyId()}:${attempt}`);
  return (
    <Shell title="Question" backLabel="Home" tabless onBack={() => navigate(agencyHomePath(openAgencyId()))}>
      {polls.state === "loading" ? <LoadingLine /> : null}
      {polls.state === "error" ? <LoadFailed words="The question could not be loaded." onRetry={() => setAttempt(attempt + 1)} /> : null}
      {polls.state === "ready" && polls.data.length === 0 ? <EmptyCard words="No question is open" /> : null}
      {polls.state === "ready" ? polls.data.map((poll) => <OpenQuestion key={poll.id} poll={poll} />) : null}
    </Shell>
  );
}

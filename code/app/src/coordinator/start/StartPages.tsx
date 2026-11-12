import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { doSomethingPath } from "../../routes";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { Field } from "../../ui/Field";
import { SearchSelect } from "../../ui/SearchSelect";
import { Shell } from "../../ui/Shell";
import { coordinatorOrderPath, draftOf, mcpStartClient, unitOf, type PosterChoice, type StartClient, type StartStep } from "./api";
import { mcpProductsClient, noOfferWords, offeredProducts, resolveProduct, type ProductsClient } from "./products";

const isNumeric = (type: string) => type === "number" || type === "currency";

type FormProps = { client: StartClient; products: ProductsClient; step: StartStep; poster: PosterChoice; done: (id: string) => void };

function StartForm({ client, products, step, poster, done }: FormProps) {
  const [posterId, setPosterId] = useState(poster.kind === "one" ? poster.poster.id : "");
  const offers = useLoad(() => (posterId === "" ? Promise.resolve([]) : products.offers(posterId)), posterId);
  const [answers, setAnswers] = useState<string[]>(step.questions.map(() => ""));
  const [problem, setProblem] = useState("");
  const [sending, setSending] = useState(false);
  const start = async () => {
    const draft = draftOf(step.questions, answers);
    if (posterId === "") return setProblem("Choose the poster.");
    if (draft.product === "" || !(draft.price > 0) || !(draft.minimum > 0)) return setProblem("Fill in every field.");
    const offered = offers.state === "ready" ? offeredProducts(offers.data) : [];
    const product = offered.length === 0 ? draft.product : resolveProduct(draft.product, offered)?.key;
    if (product === undefined) return setProblem(noOfferWords(offered));
    setProblem("");
    setSending(true);
    try {
      done((await client.start({ ...draft, product, posterId })).id);
    } catch {
      setProblem("The group order was not started. Try again.");
      setSending(false);
    }
  };
  if (poster.kind === "none") {
    return <EmptyCard words="No poster is approved yet." />;
  }
  return (
    <Card>
      {poster.kind === "several" ? (
        <SearchSelect label="Supplier" choices={poster.posters.map((p) => ({ value: p.id, label: p.name }))} value={posterId} onChange={setPosterId} />
      ) : null}
      {step.questions.map((q, i) => (
        <Field
          key={i}
          label={q.prompt}
          inputMode={isNumeric(q.answerType) ? "decimal" : undefined}
          {...unitOf(q.answerType)}
          value={answers[i]}
          onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))}
        />
      ))}
      {problem ? <p className="ferr">{problem}</p> : null}
      <Button kind="primary" disabled={sending} onClick={start}>
        Start
      </Button>
    </Card>
  );
}

export function StartPage({ client = mcpStartClient, products = mcpProductsClient }: { client?: StartClient; products?: ProductsClient }) {
  const navigate = useNavigate();
  const { stepId = "" } = useParams();
  const [attempt, setAttempt] = useState(0);
  const retry = () => setAttempt(attempt + 1);
  const loaded = useLoad(() => client.waiting(), `${stepId}:${attempt}`);
  const posterLoaded = useLoad(() => client.poster(), `${stepId}:${attempt}`);
  const step = loaded.state === "ready" ? loaded.data.find((s) => s.id === stepId) : undefined;
  return (
    <Shell title={step?.title ?? ""} onBack={() => navigate(-1)}>
      {loaded.state === "error" ? <LoadFailed words="This task could not be opened." onRetry={retry} /> : null}
      {loaded.state === "ready" && !step ? <EmptyCard words="This task has closed." /> : null}
      {step && posterLoaded.state === "error" ? <LoadFailed words="This task could not be opened." onRetry={retry} /> : null}
      {step && posterLoaded.state === "ready" ? (
        <StartForm client={client} products={products} step={step} poster={posterLoaded.data} done={(id) => navigate(id ? coordinatorOrderPath(id) : doSomethingPath())} />
      ) : null}
    </Shell>
  );
}

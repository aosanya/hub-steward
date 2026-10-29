import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { Button } from "../../ui/Button";
import { LoadFailed } from "../../ui/LoadState";
import { Chip } from "../../ui/Chip";
import { ListRow, Rows } from "../../ui/ListRow";
import { Shell } from "../../ui/Shell";
import { mcpWantedClient, type Asked, type WantedClient } from "./api";
import { buyInputs } from "./buyInputs";
import { dayName } from "./dates";
import { foundRows, shopNameOf, wantedFromAsks } from "./found";
import { wantedFrom } from "./wantedQuery";

const chipOf = (answer: Asked["answer"]) =>
  answer === "yes" ? (
    <Chip tone="success">Yes</Chip>
  ) : answer === "no" ? (
    <Chip tone="danger">No</Chip>
  ) : (
    <Chip>Waiting</Chip>
  );

export function AskedPage({ client = mcpWantedClient }: { client?: WantedClient }) {
  const { requestId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const fromUrl = wantedFrom(params);
  const loaded = useLoad(async () => {
    const [asked, shops, found, offers] = await Promise.all([
      client.listAsked(requestId),
      client.listShops(),
      client.listFound(),
      client.listOffers().catch(() => []),
    ]);
    return {
      asked: asked.map((ask) => ({ ...ask, name: shopNameOf(shops, ask.shopId) })),
      found: foundRows(found, asked, shops, offers),
      wanted: wantedFromAsks(asked),
    };
  }, requestId);
  const wanted = fromUrl.what !== "" || loaded.state !== "ready" ? fromUrl : loaded.data.wanted;
  const sub = [wanted.quantity, wanted.neededBy && `by ${dayName(wanted.neededBy)}`].filter(Boolean).join(" · ");

  return (
    <Shell title={wanted.what} sub={sub} onBack={() => navigate(buyInputs)}>
      {loaded.state === "error" ? <LoadFailed words="The shops you asked could not be loaded." /> : null}
      {loaded.state === "ready" && loaded.data.found.length > 0 ? (
        <>
          <h2>Found for you</h2>
          <Rows>
            {loaded.data.found.map((yes) => (
              <ListRow
                key={yes.id}
                title={yes.name}
                meta={yes.meta}
                end={
                  yes.buyPath ? (
                    <Button kind="primary" onClick={() => navigate(yes.buyPath)}>
                      Buy now
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </Rows>
        </>
      ) : null}
      {loaded.state === "ready" ? (
        <>
          <h2>Asked</h2>
          <Rows>
            {loaded.data.asked.map((ask) => (
              <ListRow key={ask.id} title={ask.name} end={chipOf(ask.answer)} />
            ))}
          </Rows>
        </>
      ) : null}
    </Shell>
  );
}

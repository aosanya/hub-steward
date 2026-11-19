import { useState } from "react";
import { ChoiceGroup, ChoiceRow } from "../../shared/ui/ChoiceRow";
import { Field } from "../../shared/ui/Field";
import { LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { openAgencyId } from "../../shared/wakala/openAgency";
import type { QuestionEntry } from "./QuestionInput";
import { useLoad } from "./useLoad";
import { loadPlaces, moreThanShown, placesMatching } from "./places";

const searchLabel = "Search streets and addresses";

const freeTextLabel = "Something else";

const failedWords = "The streets and addresses could not be loaded. Open this step again, or ask the council office to check that you may answer it.";

const typeInsteadWords = `You can type the place in ${freeTextLabel}.`;

const failedWordsFor = (allowFreeText?: boolean) => (allowFreeText ? `${failedWords} ${typeInsteadWords}` : failedWords);

const narrowWords = "Keep typing to narrow the list.";

export function AddressInput({ q, value, error, onChange }: QuestionEntry) {
  const places = useLoad(loadPlaces, `places:${openAgencyId()}`);
  const [search, setSearch] = useState("");
  const picked = value.placeRef ?? "";
  const all = places.state === "ready" ? places.data : [];
  return (
    <>
      <ChoiceGroup label={q.prompt} error={error}>
        <Field label={searchLabel} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        {places.state === "loading" ? <LoadingLine /> : null}
        {places.state === "error" ? <LoadFailed words={failedWordsFor(q.allow_free_text)} /> : null}
        {placesMatching(all, search, picked).map((place) => (
          <ChoiceRow key={place.ref} type="radio" name={q.id} label={place.words} checked={picked === place.ref} onChange={() => onChange({ text: place.words, placeRef: place.ref })} />
        ))}
        {moreThanShown(all, search) ? <p className="meta">{narrowWords}</p> : null}
        {q.allow_free_text ? <Field label={freeTextLabel} value={picked === "" ? value.text : ""} onChange={(e) => onChange({ text: e.target.value, placeRef: "" })} /> : null}
      </ChoiceGroup>
      {q.helper ? <p className="meta">{q.helper}</p> : null}
    </>
  );
}

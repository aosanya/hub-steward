import { callTool } from "../../shared/wakala/mcp";

export type Place = { ref: string; words: string };

const addressTool = "digitaltwin_address_list";

export const addressAnswerType = "address";

export const shownLimit = 12;

const textOf = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const byWords = (a: Place, b: Place) => a.words.localeCompare(b.words, "hu", { numeric: true });

export const placesOf = (rows: Record<string, unknown>[]): Place[] => {
  const streets = new Map<string, Place>();
  const addresses: Place[] = [];
  for (const row of rows) {
    const street = textOf(row.street);
    if (street === "") continue;
    streets.set(street, { ref: `street:${street}`, words: street });
    const number = textOf(row.number);
    const id = textOf(row.id);
    if (number !== "" && id !== "") addresses.push({ ref: `address:${id}`, words: `${street} ${number}` });
  }
  return [...[...streets.values()].sort(byWords), ...addresses.sort(byWords)];
};

export const loadPlaces = async (): Promise<Place[]> => {
  const reply = (await callTool("", addressTool)) as { items?: unknown } | null;
  return placesOf(Array.isArray(reply?.items) ? (reply.items as Record<string, unknown>[]) : []);
};

export const placesMatching = (places: Place[], search: string, picked: string): Place[] => {
  const wanted = search.trim().toLowerCase();
  const matching = places.filter((place) => wanted === "" || place.words.toLowerCase().includes(wanted));
  const shown = matching.slice(0, shownLimit);
  const pickedPlace = places.find((place) => place.ref === picked);
  return pickedPlace && !shown.includes(pickedPlace) ? [pickedPlace, ...shown] : shown;
};

export const moreThanShown = (places: Place[], search: string) =>
  places.filter((place) => search.trim() === "" || place.words.toLowerCase().includes(search.trim().toLowerCase())).length > shownLimit;
